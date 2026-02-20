import csv
from pathlib import Path
from config import CSV_DIR

class GestorCSV:
    def __init__(self, archivo: str = "personajes.csv"):
        CSV_DIR.mkdir(parents=True, exist_ok=True)
        self.path = CSV_DIR / archivo

    def escribir(self, fila: tuple[str, ...]) -> None:
        existe = self.path.exists()
        with self.path.open("a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(fila)

    def leer_ultima(self) -> tuple[str, ...]:
        if not self.path.exists():
            return ()
        with self.path.open("r", newline="", encoding="utf-8") as f:
            rows = list(csv.reader(f))
            if not rows:
                return ()
            return tuple(rows[-1])

