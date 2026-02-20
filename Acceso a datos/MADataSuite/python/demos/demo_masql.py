from engine.MASQL import MASQL
from config import MASQL_ROOT

def run():
    db = MASQL(MASQL_ROOT)

    print("SHOW DATABASES; ->", db.peticion("SHOW DATABASES;"))
    print("USE clientes; ->", db.peticion("USE clientes;"))
    print("SHOW TABLES; ->", db.peticion("SHOW TABLES;"))

    insert = "INSERT INTO clientes (nombre, apellidos, email) VALUES ('Miguel','Vargas','mivaro@gmail.com'),('Betlem','Codina','betcomar@gmail.com');"
    print("INSERT ->", db.peticion(insert))

    sel = db.peticion("SELECT * FROM clientes;")
    print("SELECT ->", sel)

if __name__ == "__main__":
    run()

