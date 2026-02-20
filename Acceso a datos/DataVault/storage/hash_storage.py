import hashlib
import json
from pathlib import Path
from config import HASH_DIR

def clave_hash(nombre: str, importancia: str, tipo: str) -> str:
    cadena = f"{nombre}{importancia}{tipo}".encode("utf-8")
    return hashlib.md5(cadena).hexdigest()

def guardar_personaje(personaje: dict) -> Path:
    HASH_DIR.mkdir(parents=True, exist_ok=True)
    h = clave_hash(personaje["nombre"], personaje["importancia"], personaje["tipo"])
    path = HASH_DIR / f"{h}.json"
    path.write_text(json.dumps(personaje, ensure_ascii=False, indent=2), encoding="utf-8")
    return path

def leer_personaje(hash_id: str) -> dict:
    path = HASH_DIR / f"{hash_id}.json"
    return json.loads(path.read_text(encoding="utf-8"))

def guardar_lote(personajes: list[dict]) -> list[str]:
    hashes = []
    for p in personajes:
        h = clave_hash(p["nombre"], p["importancia"], p["tipo"])
        guardar_personaje(p)
        hashes.append(h)
    return hashes

