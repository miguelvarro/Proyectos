from dataclasses import dataclass, asdict
from datetime import datetime
import uuid

@dataclass
class Registro:
    id: str
    titulo: str
    contenido: str
    timestamp: str

    @staticmethod
    def nuevo(titulo: str, contenido: str) -> "Registro":
        return Registro(
            id=str(uuid.uuid4()),
            titulo=titulo,
            contenido=contenido,
            timestamp=datetime.now().isoformat(timespec="seconds"),
        )

    def to_dict(self) -> dict:
        return asdict(self)

