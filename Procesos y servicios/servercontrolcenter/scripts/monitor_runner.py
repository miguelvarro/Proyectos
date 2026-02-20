#!/usr/bin/env python3
import os
import sys
import time
import argparse
import platform
import subprocess
from pathlib import Path


def os_family():
    return "Windows" if platform.system().lower().startswith("win") else "Unix"


def read_pid(pid_file: Path):
    if not pid_file.exists():
        return None
    try:
        s = pid_file.read_text(encoding="utf-8").strip()
        if not s.isdigit():
            return None
        return int(s)
    except Exception:
        return None


def write_pid(pid_file: Path, pid: int):
    pid_file.parent.mkdir(parents=True, exist_ok=True)
    pid_file.write_text(str(pid), encoding="utf-8")


def remove_pid(pid_file: Path):
    try:
        pid_file.unlink(missing_ok=True)  # py3.8+ on some envs may not have missing_ok; fallback below
    except TypeError:
        try:
            if pid_file.exists():
                pid_file.unlink()
        except Exception:
            pass
    except Exception:
        pass


def is_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if os_family() == "Windows":
        try:
            out = subprocess.check_output(['tasklist', '/FI', f'PID eq {pid}'], text=True, errors="ignore")
            return str(pid) in out
        except Exception:
            return False
    else:
        try:
            # kill -0 doesn't kill; just checks existence
            res = subprocess.run(['kill', '-0', str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return res.returncode == 0
        except Exception:
            return False


def start(monitor_script: Path, data_dir: Path, pid_file: Path, log_dir: Path, interval: float):
    log_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    if not monitor_script.exists():
        print(f"ERROR: monitor script not found: {monitor_script}")
        return 1

    pid = read_pid(pid_file)
    if pid and is_running(pid):
        print(f"OK: already running (pid={pid})")
        return 0

    ts = time.strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"monitor_{ts}.log"

    cmd = [sys.executable, str(monitor_script), "--data-dir", str(data_dir), "--interval", str(interval)]

    if os_family() == "Windows":
        # Start detached via powershell for pid
        ps_cmd = [
            "powershell", "-NoProfile", "-Command",
            f"$p = Start-Process -FilePath '{cmd[0]}' -ArgumentList '{' '.join(cmd[1:])}' "
            f"-WindowStyle Hidden -PassThru -RedirectStandardOutput '{log_file}' -RedirectStandardError '{log_file}'; "
            f"$p.Id"
        ]
        try:
            out = subprocess.check_output(ps_cmd, text=True, errors="ignore").strip()
            if out.isdigit():
                write_pid(pid_file, int(out))
                print(f"OK: started pid={out} log={log_file}")
                return 0
        except Exception as e:
            print(f"WARN: powershell start failed: {e}")

        # Fallback: start without PID
        subprocess.Popen(cmd, stdout=open(log_file, "a", encoding="utf-8"), stderr=subprocess.STDOUT, creationflags=subprocess.DETACHED_PROCESS)
        print(f"OK: started (fallback, no pid) log={log_file}")
        return 0

    else:
        # Unix: nohup style
        with open(log_file, "a", encoding="utf-8") as f:
            p = subprocess.Popen(cmd, stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
        write_pid(pid_file, p.pid)
        print(f"OK: started pid={p.pid} log={log_file}")
        return 0


def stop(pid_file: Path):
    pid = read_pid(pid_file)
    if not pid:
        print("OK: not running (no pid file)")
        return 0

    if os_family() == "Windows":
        res = subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, text=True)
        remove_pid(pid_file)
        if res.returncode == 0:
            print(f"OK: stopped pid={pid}")
            return 0
        print(f"ERROR: taskkill failed: {res.stdout} {res.stderr}")
        return 1
    else:
        res = subprocess.run(["kill", str(pid)], capture_output=True, text=True)
        if res.returncode != 0:
            # force
            subprocess.run(["kill", "-9", str(pid)], capture_output=True, text=True)
        remove_pid(pid_file)
        print(f"OK: stopped pid={pid}")
        return 0


def status(pid_file: Path):
    pid = read_pid(pid_file)
    if pid and is_running(pid):
        print(f"RUNNING pid={pid}")
        return 0
    print("STOPPED")
    return 1


def main():
    here = Path(__file__).resolve().parent
    root = here.parent

    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["start", "stop", "status"])
    ap.add_argument("--monitor-script", default=str(here / "server_monitor.py"))
    ap.add_argument("--data-dir", default=str(root / "monitor_data"))
    ap.add_argument("--pid-file", default=str(root / "public" / "logs" / "monitor.pid"))
    ap.add_argument("--log-dir", default=str(root / "public" / "logs"))
    ap.add_argument("--interval", type=float, default=2.0)
    args = ap.parse_args()

    monitor_script = Path(args.monitor_script).resolve()
    data_dir = Path(args.data_dir).resolve()
    pid_file = Path(args.pid_file).resolve()
    log_dir = Path(args.log_dir).resolve()

    if args.cmd == "start":
        return start(monitor_script, data_dir, pid_file, log_dir, args.interval)
    if args.cmd == "stop":
        return stop(pid_file)
    if args.cmd == "status":
        return status(pid_file)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

