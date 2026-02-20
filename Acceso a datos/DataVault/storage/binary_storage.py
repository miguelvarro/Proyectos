import pickle
from pathlib import Path
from config import BINARIO_DIR

CLIENTES_PATH = BINARIO_DIR / "clientes.bin"

def guardar_clientes(clientes: list[dict]) -> Path:
    CLIENTES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CLIENTES_PATH.open("wb") as f:
        pickle.dump(clientes, f)
    return CLIENTES_PATH

def cargar_clientes() -> list[dict]:
    if not CLIENTES_PATH.exists():
        return []
    with CLIENTES_PATH.open("rb") as f:
        return pickle.load(f)

def demo_clientes(n: int = 10) -> list[dict]:
    return [
        {
            "nombre": "Miguel Angel",
            "apellidos": "Vargas",
            "emails": ["migue@migguevar.com", "mike@miguevaro.com"],
        }
        for _ in range(n)
    ]

