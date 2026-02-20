import base64
import os
import zlib
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, List, Tuple

from backend.utils.files import ensure_dir, safe_name



@dataclass
class FileChunk:
    relpath: str
    data: bytes
    crc32: int
    size: int

def _read_and_crc(path: Path, base: Path) -> FileChunk:
    data = path.read_bytes()
    crc = zlib.crc32(data) & 0xffffffff
    rel = str(path.relative_to(base)).replace("\\", "/")
    return FileChunk(relpath=rel, data=data, crc32=crc, size=len(data))

def _zip_store(chunks: List[FileChunk]) -> bytes:
    """
    ZIP mínimo con método STORE (sin compresión) para simplificar.
    Aun así el pipeline es multinúcleo: lectura+CRC en paralelo.
    """
    # Estructuras ZIP
    # Local file header: 30 bytes + filename + data
    # Central directory + end record
    import struct
    out = bytearray()
    central = bytearray()
    offset = 0

    for c in chunks:
        name_bytes = c.relpath.encode("utf-8")
        # Local header signature
        out += struct.pack("<IHHHHHIIIHH",
            0x04034b50,  # local file header sig
            20,          # version needed
            0,           # flags
            0,           # method 0 store
            0,           # mtime
            0,           # mdate
            c.crc32,
            c.size,
            c.size,
            len(name_bytes),
            0            # extra
        )
        out += name_bytes
        out += c.data

        # Central dir header
        central += struct.pack("<IHHHHHHIIIHHHHHII",
            0x02014b50,  # central dir sig
            20,          # version made by
            20,          # version needed
            0,           # flags
            0,           # method
            0,           # mtime
            0,           # mdate
            c.crc32,
            c.size,
            c.size,
            len(name_bytes),
            0, 0,        # extra, comment
            0, 0,        # disk, int attrs
            0,           # ext attrs
            offset
        )
        central += name_bytes

        offset += 30 + len(name_bytes) + c.size

    cd_offset = len(out)
    out += central

    # End of central directory
    import struct
    out += struct.pack("<IHHHHIIH",
        0x06054b50,
        0, 0,
        len(chunks),
        len(chunks),
        len(central),
        cd_offset,
        0
    )

    return bytes(out)

def zip_outputs(
    input_dir: Path,
    out_dir: Path,
    workers: int = 0,
    on_progress: Callable[[int,str], None] = lambda pct, msg: None
) -> Tuple[str, bytes]:
    """
    Crea ZIP de input_dir. Multinúcleo real en la fase de lectura+CRC.
    Generación final del zip es secuencial (por simplicidad y robustez).
    """
    ensure_dir(out_dir)
    if not input_dir.exists():
        raise FileNotFoundError(f"No existe {input_dir}")

    files = [p for p in input_dir.rglob("*") if p.is_file()]
    if not files:
        raise RuntimeError("No hay archivos para comprimir.")

    workers = workers or (os.cpu_count() or 2)
    on_progress(0, f"Zipping {len(files)} files with {workers} processes…")

    chunks: List[FileChunk] = []
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_read_and_crc, p, input_dir) for p in files]
        done = 0
        for f in as_completed(futs):
            chunks.append(f.result())
            done += 1
            pct = int(done*80/len(files))  # hasta 80% leyendo
            if done % max(1, len(files)//10) == 0 or done == len(files):
                on_progress(pct, f"Read+CRC: {done}/{len(files)}")

    on_progress(90, "Building ZIP container…")
    zip_bytes = _zip_store(sorted(chunks, key=lambda c: c.relpath))

    filename = safe_name("outputs.zip")
    out_path = out_dir / filename
    out_path.write_bytes(zip_bytes)

    on_progress(100, f"ZIP done: {filename}")
    return filename, zip_bytes

def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")

