from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
RENDERS_DIR = OUTPUT_DIR / "renders"
ZIPS_DIR = OUTPUT_DIR / "zips"

# Paralelismo
DEFAULT_WORKERS = 0  # 0 => usa os.cpu_count()

