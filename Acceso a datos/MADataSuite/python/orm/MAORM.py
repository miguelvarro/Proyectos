import mysql.connector
import json

class MAORM:
    """
    ORM/Bridge ligero basado en tu JsonMySQLBridge.
    Mapea dicts con emails (lista/obj) -> columna JSON en MySQL.
    """
    def __init__(self, host: str, user: str, password: str, database: str, port: int = 3306):
        self.conn = mysql.connector.connect(
            host=host, user=user, password=password, database=database, port=port
        )
        self.cursor = self.conn.cursor()

    def create_table_clientes(self) -> None:
        self.cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255),
            apellidos VARCHAR(255),
            emails JSON
        );
        """)
        self.conn.commit()

    def insert_cliente(self, cliente: dict) -> None:
        sql = "INSERT INTO clientes (nombre, apellidos, emails) VALUES (%s, %s, %s)"
        data = (cliente["nombre"], cliente["apellidos"], json.dumps(cliente["emails"], ensure_ascii=False))
        self.cursor.execute(sql, data)
        self.conn.commit()

    def fetch_clientes(self) -> list[dict]:
        self.cursor.execute("SELECT * FROM clientes")
        filas = self.cursor.fetchall()
        resultados = []
        for fila in filas:
            resultados.append({
                "id": fila[0],
                "nombre": fila[1],
                "apellidos": fila[2],
                "emails": json.loads(fila[3]) if fila[3] is not None else None
            })
        return resultados

    def close(self) -> None:
        try:
            self.cursor.close()
        finally:
            self.conn.close()

