from PIL import Image
from pathlib import Path
import math
from config import IMAGENES_DIR

def _int_to_4bytes(n: int) -> bytes:
    return n.to_bytes(4, byteorder="big", signed=False)

def _4bytes_to_int(b: bytes) -> int:
    return int.from_bytes(b, byteorder="big", signed=False)

def texto_a_imagen(texto: str, salida_nombre: str) -> Path:
    """
    Codifica texto en una imagen RGB guardando:
    - 4 bytes de longitud al inicio
    - luego los bytes UTF-8 del texto
    """
    data = texto.encode("utf-8")
    payload = _int_to_4bytes(len(data)) + data

    # empaquetamos en triples (R,G,B)
    triples = []
    for i in range(0, len(payload), 3):
        chunk = payload[i:i+3]
        if len(chunk) < 3:
            chunk = chunk + b"\x00" * (3 - len(chunk))
        triples.append(tuple(chunk))

    total_pixels = len(triples)
    lado = math.ceil(math.sqrt(total_pixels))

    img = Image.new("RGB", size=(lado, lado), color=(0, 0, 0))
    px = img.load()

    idx = 0
    for y in range(lado):
        for x in range(lado):
            if idx < total_pixels:
                px[x, y] = triples[idx]
                idx += 1

    IMAGENES_DIR.mkdir(parents=True, exist_ok=True)
    out = IMAGENES_DIR / salida_nombre
    img.save(out)
    return out

def imagen_a_texto(ruta_imagen: str) -> str:
    img = Image.open(ruta_imagen)
    px = img.load()

    # leemos bytes secuencialmente
    bytes_leidos = bytearray()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            bytes_leidos.extend([r, g, b])

    if len(bytes_leidos) < 4:
        return ""

    longitud = _4bytes_to_int(bytes(bytes_leidos[:4]))
    data = bytes(bytes_leidos[4:4+longitud])
    return data.decode("utf-8", errors="replace")

