from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

SECUENCIAL_DIR = DATA_DIR / "secuencial"
BINARIO_DIR    = DATA_DIR / "binario"
HASH_DIR       = DATA_DIR / "hash"
IMAGENES_DIR   = DATA_DIR / "imagenes"
CSV_DIR        = DATA_DIR / "csv"

def ensure_dirs() -> None:
    for p in (SECUENCIAL_DIR, BINARIO_DIR, HASH_DIR, IMAGENES_DIR, CSV_DIR):
        p.mkdir(parents=True, exist_ok=True)

