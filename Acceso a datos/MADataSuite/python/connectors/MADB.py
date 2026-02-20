import mysql.connector
import json
from typing import Any

class MADB:
    """
    Conector MySQL personalizado.
    API inspirada en mi MADB.php:
      - seleccionar(tabla)
      - buscar(tabla, columna, valor)
      - tablas()
    Extras útiles:
      - ejecutar(sql, params)
      - insertar(tabla, datos_dict)
    """
    def __init__(self, host: str, usuario: str, contrasena: str, basedatos: str, port: int = 3306):
        self.host = host
        self.usuario = usuario
        self.contrasena = contrasena
        self.basedatos = basedatos
        self.port = port

        self.conexion = mysql.connector.connect(
            host=self.host,
            user=self.usuario,
            password=self.contrasena,
            database=self.basedatos,
            port=self.port
        )
        self.cursor = self.conexion.cursor(dictionary=True)

    def ejecutar(self, sql: str, params: tuple | None = None) -> None:
        self.cursor.execute(sql, params or ())
        self.conexion.commit()

    def consultar(self, sql: str, params: tuple | None = None) -> list[dict]:
        self.cursor.execute(sql, params or ())
        return self.cursor.fetchall()

    def seleccionar(self, tabla: str) -> str:
        filas = self.consultar(f"SELECT * FROM `{tabla}`")
        return json.dumps(filas, ensure_ascii=False, indent=2)

    def buscar(self, tabla: str, columna: str, valor: str) -> str:
        sql = f"SELECT * FROM `{tabla}` WHERE `{columna}` LIKE %s"
        like = f"%{valor}%"
        filas = self.consultar(sql, (like,))
        return json.dumps(filas, ensure_ascii=False, indent=2)

    def tablas(self) -> str:
        filas = self.consultar("SHOW TABLES")
        nombres = []
        for f in filas:
            nombres.extend(list(f.values()))
        return json.dumps(nombres, ensure_ascii=False, indent=2)

    def insertar(self, tabla: str, datos: dict[str, Any]) -> None:
        cols = ", ".join([f"`{c}`" for c in datos.keys()])
        placeholders = ", ".join(["%s"] * len(datos))
        sql = f"INSERT INTO `{tabla}` ({cols}) VALUES ({placeholders})"
        self.ejecutar(sql, tuple(datos.values()))

    def cerrar(self) -> None:
        try:
            self.cursor.close()
        finally:
            self.conexion.close()

