from connectors.MADB import MADB
from config import MYSQL
import json

def run():
    db = MADB(MYSQL.host, MYSQL.user, MYSQL.password, MYSQL.database, MYSQL.port)

    print("Tablas:", db.tablas())

    # Asegurar una tabla simple (para demo rápida)
    db.ejecutar("""
    CREATE TABLE IF NOT EXISTS clientes_simple (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255),
        apellidos VARCHAR(255),
        email VARCHAR(255)
    );
    """)

    db.insertar("clientes_simple", {"nombre": "Miguel", "apellidos": "Vargas", "email": "mivaro@gmail.com"})
    db.insertar("clientes_simple", {"nombre": "Betlem", "apellidos": "Codina", "email": "betcomar@gmail.com"})

    print("Seleccionar clientes_simple:")
    print(db.seleccionar("clientes_simple"))

    print("Buscar nombre LIKE 'Mig':")
    print(db.buscar("clientes_simple", "nombre", "Mig"))

    db.cerrar()

if __name__ == "__main__":
    run()

