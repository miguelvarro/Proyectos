from dataclasses import dataclass
from pathlib import Path

# --- Configuración MySQL (ajusta a tu entorno) ---
@dataclass(frozen=True)
class MySQLConfig:
    host: str = "localhost"
    user: str = "root"
    password: str = ""
    database: str = "baseanime"   
    port: int = 3306

MYSQL = MySQLConfig()

# --- Configuración del motor MASQL (CSV) ---
BASE_DIR = Path(__file__).resolve().parent
MASQL_ROOT = BASE_DIR / "masql_db"  # aquí MASQL crea carpetas y csv (tipo "db/")
MASQL_ROOT.mkdir(parents=True, exist_ok=True)

