# server_monitor.py
import psutil
import csv
from datetime import datetime, timedelta
import re
import os
from pytz import timezone  # pip install pytz

# --- Config ---
CSV_DIR = 'monitor_data'
os.makedirs(CSV_DIR, exist_ok=True)

# --- Helper Functions ---
def safe_filename(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]', '_', str(name))
    name = name.strip().strip('.')
    if not name:
        name = "unnamed"
    return name

def save_to_csv(filename, headers, data):
    """Saves data to CSV, creating headers if the file doesn't exist."""
    filepath = os.path.join(CSV_DIR, filename)
    file_exists = os.path.isfile(filepath)
    with open(filepath, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(headers)
        writer.writerow(data)

# --- CPU Monitoring ---
def monitor_cpu(now_str: str):
    cpu_usage = psutil.cpu_percent(interval=1)
    save_to_csv('cpu_usage.csv', ['date', 'cpu_usage'], [now_str, cpu_usage])

# --- RAM Monitoring ---
def monitor_ram(now_str: str):
    ram = psutil.virtual_memory()
    save_to_csv(
        'ram_usage.csv',
        ['date', 'ram_usage_percent', 'ram_total_gb'],
        [now_str, ram.percent, round(ram.total / (1024 ** 3), 2)]
    )

# --- Disk I/O Monitoring ---
def monitor_disk_io(now_str: str):
    disk_io_counters = psutil.disk_io_counters(perdisk=True)
    for disk, io in disk_io_counters.items():
        disk_safe = safe_filename(disk)

        row = [
            now_str,
            io.read_bytes, io.write_bytes,
            io.read_count, io.write_count,
            io.read_time, io.write_time
        ]
        headers = ['date','read_bytes','write_bytes','read_ops','write_ops','read_time_ms','write_time_ms']

        if hasattr(io, "busy_time"):
            headers.append('busy_time_ms')
            row.append(io.busy_time)

        save_to_csv(f'disk_io_{disk_safe}.csv', headers, row)

# --- Disk Usage Monitoring ---
def monitor_disk_usage(now_str: str):
    try:
        disk_usage = psutil.disk_usage('/')
    except Exception:
        disk_usage = psutil.disk_usage(r'C:\\')

    save_to_csv(
        'disk_usage.csv',
        ['date', 'disk_usage_percent', 'disk_total_gb', 'disk_free_gb'],
        [now_str, disk_usage.percent, round(disk_usage.total / (1024 ** 3), 2), round(disk_usage.free / (1024 ** 3), 2)]
    )

# --- Bandwidth Monitoring ---
def monitor_bandwidth(now_str: str):
    net_io = psutil.net_io_counters(pernic=True)
    for iface, io in net_io.items():
        iface_safe = safe_filename(iface)
        save_to_csv(
            f'bandwidth_{iface_safe}.csv',
            ['date', 'bytes_sent', 'bytes_recv', 'packets_sent', 'packets_recv'],
            [now_str, io.bytes_sent, io.bytes_recv, io.packets_sent, io.packets_recv]
        )

# --- Processes Monitoring ---
def monitor_processes(now_str: str, top_n: int = 10):
    """
    Genera processes.csv con los TOP procesos por uso de memoria (RSS).
    Robusto en Windows: ignora AccessDenied y procesos que desaparecen.
    """
    processes = []

    for p in psutil.process_iter(attrs=["pid", "name", "username", "memory_info"]):
        try:
            info = p.info
            mem_info = info.get("memory_info")
            rss = mem_info.rss if mem_info else 0
            mem_mb = round(rss / (1024 * 1024), 2)

            processes.append([
                now_str,
                info.get("pid", ""),
                info.get("name", "") or "unknown",
                info.get("username", "") or "",
                mem_mb
            ])
        except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
            continue
        except Exception:
            continue


    processes.sort(key=lambda r: r[-1], reverse=True)
    processes = processes[:top_n]


    filepath = os.path.join(CSV_DIR, 'processes.csv')
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['date', 'pid', 'name', 'user', 'mem_mb'])
        writer.writerows(processes)

# --- Apache2 Request Rate Monitoring ---
def monitor_apache_request_rate():
    ACCESS_LOG = r'C:\xampp\apache\logs\access.log'
    request_counts = {}

    current_time = datetime.now(timezone('UTC')) 
    time_window = timedelta(minutes=1)

    if not os.path.isfile(ACCESS_LOG):
        return

    try:
        with open(ACCESS_LOG, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                match = re.search(r'\[([^\]]+)\]', line)
                if match:
                    timestamp_str = match.group(1)
                    try:
                        timestamp = datetime.strptime(timestamp_str, '%d/%b/%Y:%H:%M:%S %z')  # timezone-aware
                    except Exception:
                        continue

                    if (current_time - timestamp) <= time_window:
                        minute_key = timestamp.strftime('%Y-%m-%d %H:%M')
                        request_counts[minute_key] = request_counts.get(minute_key, 0) + 1
    except Exception:
        return

    for minute, count in request_counts.items():
        save_to_csv('apache_request_rate.csv', ['date', 'requests_per_minute'], [minute, count])

# --- Main ---
if __name__ == '__main__':
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    monitor_cpu(now_str)
    monitor_ram(now_str)
    monitor_disk_io(now_str)
    monitor_disk_usage(now_str)
    monitor_bandwidth(now_str)

    # Crea processes.csv
    monitor_processes(now_str, top_n=10)

    monitor_apache_request_rate()

    print("Monitoring data saved.")

