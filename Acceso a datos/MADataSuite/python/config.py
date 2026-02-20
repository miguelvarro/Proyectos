from dataclasses import dataclass
from pathlib import Path

# --- Configuración MySQL  ---
@dataclass(frozen=True)
class MySQLConfig:
    host: str = "localhost"
    user: str = "root"
    password: str = ""
    database: str = "baseanime"   
    port: int = 3306

MYSQL = MySQLConfig()

# --- Configuración del motor MASQL  ---
BASE_DIR = Path(__file__).resolve().parent
MASQL_ROOT = BASE_DIR / "masql_db"  
MASQL_ROOT.mkdir(parents=True, exist_ok=True)

