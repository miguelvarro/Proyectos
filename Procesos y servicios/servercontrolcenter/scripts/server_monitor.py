#!/usr/bin/env python3
import os
import sys
import time
import csv
import argparse
import platform
import subprocess
from datetime import datetime

try:
    import psutil  # optional
except Exception:
    psutil = None


def now_ts():
    dt = datetime.now()
    return dt.isoformat(timespec="seconds"), int(dt.timestamp())


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def append_row(csv_path: str, ts_iso: str, epoch: int, value: float):
    new_file = not os.path.exists(csv_path)
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(["ts_iso", "epoch", "value"])
        w.writerow([ts_iso, epoch, f"{value:.6f}"])


def get_cpu_percent(prev_cpu=None):
    if psutil:
        # non-blocking if interval=None uses last cached; we prefer short interval in main loop
        return psutil.cpu_percent(interval=None)
    # Fallback (rough)
    return 0.0


def get_ram_percent():
    if psutil:
        return psutil.virtual_memory().percent
    # Fallback: unknown
    return 0.0


def get_disk_usage_percent(path="/"):
    try:
        if psutil:
            return psutil.disk_usage(path).percent
        st = os.statvfs(path)
        total = st.f_frsize * st.f_blocks
        free = st.f_frsize * st.f_bavail
        used = total - free
        return (used / total) * 100.0 if total else 0.0
    except Exception:
        return 0.0


def get_disk_io_bytes():
    if psutil:
        io = psutil.disk_io_counters()
        return io.read_bytes, io.write_bytes
    return None


def get_net_io_bytes():
    if psutil:
        io = psutil.net_io_counters()
        return io.bytes_recv, io.bytes_sent
    return None


def get_process_count():
    if psutil:
        try:
            return len(psutil.pids())
        except Exception:
            return 0
    # fallback:
    sysname = platform.system().lower()
    try:
        if "windows" in sysname:
            out = subprocess.check_output(["tasklist"], text=True, errors="ignore")
            # crude: count lines minus header
            lines = [ln for ln in out.splitlines() if ln.strip()]
            return max(0, len(lines) - 3)
        else:
            out = subprocess.check_output(["ps", "-e"], text=True, errors="ignore")
            lines = [ln for ln in out.splitlines() if ln.strip()]
            return max(0, len(lines) - 1)
    except Exception:
        return 0


def find_apache_access_log():
    # Best-effort paths
    candidates = [
        "/var/log/apache2/access.log",
        "/var/log/httpd/access_log",
        "/var/log/httpd/access.log",
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


def apache_request_rate(access_log, window_sec=10):
    """
    Estima requests/seg leyendo nuevas líneas del access.log.
    Si no hay log o no se puede leer, devuelve 0.
    """
    if not access_log or not os.path.isfile(access_log):
        return 0.0

    # Usamos offset en un archivo .pos junto al log para persistir posición
    pos_file = access_log + ".pos"
    try:
        pos = 0
        if os.path.isfile(pos_file):
            with open(pos_file, "r", encoding="utf-8") as f:
                pos = int(f.read().strip() or "0")

        with open(access_log, "rb") as f:
            f.seek(pos)
            data = f.read()
            new_pos = f.tell()

        # Guardar nueva posición
        with open(pos_file, "w", encoding="utf-8") as f:
            f.write(str(new_pos))

        # Contar líneas nuevas
        lines = data.splitlines()
        count = len(lines)
        return count / float(window_sec) if window_sec > 0 else float(count)
    except Exception:
        return 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=None, help="Ruta a monitor_data/")
    ap.add_argument("--interval", type=float, default=2.0, help="Segundos entre muestras")
    ap.add_argument("--disk-path", default=None, help="Ruta para disk_usage (default: root)")
    ap.add_argument("--apache-log", default=None, help="Ruta access.log de Apache (opcional)")
    args = ap.parse_args()

    # Resolver data dir
    # Si no se pasa, asumimos ../monitor_data relativo a scripts/
    here = os.path.dirname(os.path.abspath(__file__))
    default_data = os.path.abspath(os.path.join(here, "..", "monitor_data"))
    data_dir = args.data_dir or default_data
    ensure_dir(data_dir)

    disk_path = args.disk_path
    if not disk_path:
        disk_path = "C:\\" if platform.system().lower().startswith("win") else "/"

    access_log = args.apache_log or find_apache_access_log()

    # Inicializar psutil cpu cache
    if psutil:
        psutil.cpu_percent(interval=None)

    # para rates (bytes/s)
    last_disk = get_disk_io_bytes()
    last_net = get_net_io_bytes()
    last_epoch = int(time.time())

    # Para apache rate: usamos ventana ~interval*5 (para algo más estable)
    apache_window = max(5.0, float(args.interval) * 5.0)

    print(f"[server_monitor] data_dir={data_dir} interval={args.interval}s disk_path={disk_path}")
    if psutil:
        print("[server_monitor] psutil=OK")
    else:
        print("[server_monitor] psutil=NO (fallback limitado)")
    if access_log:
        print(f"[server_monitor] apache_log={access_log}")
    else:
        print("[server_monitor] apache_log=NO (rate=0)")

    while True:
        ts_iso, epoch = now_ts()

        # CPU/RAM/DISK
        cpu = float(get_cpu_percent())
        ram = float(get_ram_percent())
        disk = float(get_disk_usage_percent(disk_path))

        append_row(os.path.join(data_dir, "cpu.csv"), ts_iso, epoch, cpu)
        append_row(os.path.join(data_dir, "ram.csv"), ts_iso, epoch, ram)
        append_row(os.path.join(data_dir, "disk_usage.csv"), ts_iso, epoch, disk)

        # IO / Bandwidth rates
        dt = max(1, epoch - last_epoch)

        # Disk IO bytes/s
        cur_disk = get_disk_io_bytes()
        if cur_disk and last_disk:
            read_bps = (cur_disk[0] - last_disk[0]) / dt
            write_bps = (cur_disk[1] - last_disk[1]) / dt
        else:
            read_bps = 0.0
            write_bps = 0.0
        append_row(os.path.join(data_dir, "disk_io_read.csv"), ts_iso, epoch, float(read_bps))
        append_row(os.path.join(data_dir, "disk_io_write.csv"), ts_iso, epoch, float(write_bps))

        # Net bytes/s
        cur_net = get_net_io_bytes()
        if cur_net and last_net:
            rx_bps = (cur_net[0] - last_net[0]) / dt
            tx_bps = (cur_net[1] - last_net[1]) / dt
        else:
            rx_bps = 0.0
            tx_bps = 0.0
        append_row(os.path.join(data_dir, "bandwidth_rx.csv"), ts_iso, epoch, float(rx_bps))
        append_row(os.path.join(data_dir, "bandwidth_tx.csv"), ts_iso, epoch, float(tx_bps))

        # Process count
        pc = float(get_process_count())
        append_row(os.path.join(data_dir, "processes_count.csv"), ts_iso, epoch, pc)

        # Apache request rate (best-effort)
        rate = float(apache_request_rate(access_log, window_sec=apache_window)) if access_log else 0.0
        append_row(os.path.join(data_dir, "apache_request_rate.csv"), ts_iso, epoch, rate)

        # Update last
        last_disk = cur_disk or last_disk
        last_net = cur_net or last_net
        last_epoch = epoch

        time.sleep(float(args.interval))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[server_monitor] stopped by user")
        sys.exit(0)

