import json
from pathlib import Path
from config import SECUENCIAL_DIR

NOTAS_PATH = SECUENCIAL_DIR / "notas.json"

def cargar_notas() -> list[dict]:
    if not NOTAS_PATH.exists():
        return []
    contenido = NOTAS_PATH.read_text(encoding="utf-8").strip()
    if not contenido:
        return []
    return json.loads(contenido)

def guardar_notas(notas: list[dict]) -> None:
    NOTAS_PATH.parent.mkdir(parents=True, exist_ok=True)
    NOTAS_PATH.write_text(json.dumps(notas, ensure_ascii=False, indent=2), encoding="utf-8")

def agregar_nota(notas: list[dict], alumno: str, asignatura: str, valor: float) -> None:
    notas.append({"alumno": alumno, "asignatura": asignatura, "nota": valor})

def eliminar_notas_alumno(notas: list[dict], alumno: str) -> list[dict]:
    return [n for n in notas if n.get("alumno") != alumno]

