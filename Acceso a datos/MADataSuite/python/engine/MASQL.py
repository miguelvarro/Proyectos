import os
import re
import csv
import io
from pathlib import Path
from typing import Any

class MASQL:
    """
    Motor tipo SQL sobre CSV.
    - Bases de datos = carpetas dentro de MASQL_ROOT
    - Tablas = ficheros CSV dentro de la carpeta de la base
    Soporta:
      SHOW DATABASES;
      USE <db>;
      SHOW TABLES;
      INSERT INTO tabla (col1,col2) VALUES (...), (...);
      SELECT * FROM tabla;
    """
    def __init__(self, root_dir: str | Path):
        self.root = Path(root_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self.base_actual = ""

    def peticion(self, sql: str) -> Any:
        sql = sql.strip()
        up = sql.upper()

        if up == "SHOW DATABASES;":
            return self._show_databases()

        if up.startswith("USE "):
            return self._use(sql)

        if up == "SHOW TABLES;":
            return self._show_tables()

        if up.startswith("INSERT"):
            return self._insert(sql)

        if up.startswith("SELECT"):
            return self._select(sql)

        raise ValueError("Petición no soportada por MASQL.")

    def _show_databases(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted([p.name for p in self.root.iterdir() if p.is_dir()])

    def _use(self, sql: str) -> dict:
        # USE nombre;
        parts = sql.split()
        if len(parts) < 2:
            raise ValueError("USE mal formado.")
        db = parts[1].replace(";", "")
        (self.root / db).mkdir(parents=True, exist_ok=True)
        self.base_actual = db
        return {"ok": True, "base_actual": self.base_actual}

    def _show_tables(self) -> list[str]:
        self._require_db()
        base = self.root / self.base_actual
        tablas = []
        for p in base.iterdir():
            if p.is_file() and p.suffix.lower() == ".csv":
                tablas.append(p.stem)
        return sorted(tablas)

    def _insert(self, sql: str) -> dict:
        self._require_db()

        patron = re.compile(
            r"^\s*INSERT\s+INTO\s+([A-Za-z_][\w$]*)\s*"
            r"(?:\(([^)]+)\))?\s*"
            r"VALUES\s*(.+?)\s*;?\s*$",
            re.IGNORECASE | re.DOTALL
        )
        m = patron.match(sql)
        if not m:
            raise ValueError("INSERT no reconocido.")

        tabla, columnas_str, values_blob = m.groups()

        base_dir = self.root / self.base_actual
        base_dir.mkdir(parents=True, exist_ok=True)
        path_csv = base_dir / f"{tabla}.csv"

        columnas = None
        if columnas_str:
            columnas = [c.strip().strip("`") for c in columnas_str.split(",")]

        def split_tuplas(s: str):
            res, buf = [], []
            en_cadena = False
            nivel = 0
            prev = ''
            for ch in s.strip():
                if ch == "'" and prev != '\\':
                    en_cadena = not en_cadena
                    buf.append(ch)
                elif not en_cadena and ch == '(':
                    if nivel > 0:
                        buf.append(ch)
                    nivel += 1
                elif not en_cadena and ch == ')':
                    nivel -= 1
                    if nivel == 0:
                        res.append(''.join(buf).strip())
                        buf = []
                    else:
                        buf.append(ch)
                elif not en_cadena and nivel == 0 and ch == ',':
                    pass
                else:
                    buf.append(ch)
                prev = ch
            return res

        tuplas = split_tuplas(values_blob)

        filas = []
        for t in tuplas:
            reader = csv.reader(
                io.StringIO(t),
                delimiter=',',
                quotechar="'",
                escapechar='\\',
                skipinitialspace=True
            )
            vals = next(reader)
            filas.append([None if v.strip().upper() == "NULL" else v.strip() for v in vals])


        if columnas is None:
            if path_csv.exists():
                with path_csv.open(newline='', encoding='utf-8') as f:
                    r = csv.reader(f)
                    columnas = next(r, None)
            if not columnas:
                columnas = [f"c{i}" for i in range(1, len(filas[0]) + 1)]

        existe = path_csv.exists()
        with path_csv.open('a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(columnas))
            if not existe:
                writer.writeheader()
            for vals in filas:
                writer.writerow({col: (vals[i] if i < len(vals) else "") for i, col in enumerate(columnas)})

        return {"ok": True, "tabla": tabla, "filas_insertadas": len(filas)}

    def _select(self, sql: str) -> dict:
        self._require_db()

        patron = re.compile(
            r"^\s*SELECT\s+\*\s+FROM\s+([A-Za-z_][\w$]*)\s*;?\s*$",
            re.IGNORECASE
        )
        m = patron.match(sql)
        if not m:
            raise ValueError("Solo se admite: SELECT * FROM <tabla>;")

        tabla = m.group(1)
        path_csv = self.root / self.base_actual / f"{tabla}.csv"

        if not path_csv.exists():
            return {"ok": False, "error": f"La tabla '{tabla}' no existe en la base '{self.base_actual}'."}

        with path_csv.open(newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            filas = list(reader)

        return {"ok": True, "tabla": tabla, "filas": filas}

    def _require_db(self):
        if not self.base_actual:
            raise ValueError("No hay base seleccionada. Usa: USE <base>;")

