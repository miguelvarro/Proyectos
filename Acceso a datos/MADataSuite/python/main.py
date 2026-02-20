import argparse
import json
from config import MYSQL, MASQL_ROOT

def main():
    parser = argparse.ArgumentParser(description="MADataSuite - Acceso a datos (MASQL + MADB + MAORM + PHP)")
    parser.add_argument("--modo", choices=["masql", "madb", "maorm"], required=True)
    parser.add_argument("--accion", choices=["init", "seed", "list", "search"], required=True)
    parser.add_argument("--q", default="", help="texto de búsqueda (para search)")
    args = parser.parse_args()

    if args.modo == "masql":
        from engine.MASQL import MASQL
        run_masql(MASQL, args.accion, args.q)
    elif args.modo == "madb":
        from connectors.MADB import MADB
        run_madb(MADB, args.accion, args.q)
    else:
        from orm.MAORM import MAORM
        run_maorm(MAORM, args.accion, args.q)

def run_masql(MASQL, accion: str, q: str):
    db = MASQL(MASQL_ROOT)
    if accion == "init":
        db.peticion("USE clientes;")
        print("OK: base MASQL 'clientes' preparada.")
        return

    db.peticion("USE clientes;")

    if accion == "seed":
        ins = "INSERT INTO clientes (nombre, apellidos, email) VALUES ('Miguel','Vargas','mivaro@gmail.com'),('Betlem','Codina','betcomar@gmail.com');"
        print(db.peticion(ins))
        return

    if accion == "list":
        print(json.dumps(db.peticion("SELECT * FROM clientes;"), ensure_ascii=False, indent=2))
        return

    if accion == "search":
        res = db.peticion("SELECT * FROM clientes;")
        if not res.get("ok"):
            print(json.dumps(res, ensure_ascii=False, indent=2))
            return
        filas = res["filas"]
        qlow = q.lower()
        filtradas = [f for f in filas if qlow in (f.get("nombre","")+f.get("apellidos","")+f.get("email","")).lower()]
        print(json.dumps({"ok": True, "filas": filtradas}, ensure_ascii=False, indent=2))
        return

def run_madb(MADB, accion: str, q: str):
    db = MADB(MYSQL.host, MYSQL.user, MYSQL.password, MYSQL.database, MYSQL.port)
    if accion == "init":
        db.ejecutar("""
        CREATE TABLE IF NOT EXISTS clientes_simple (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255),
            apellidos VARCHAR(255),
            email VARCHAR(255)
        );
        """)
        print("OK: tabla MySQL 'clientes_simple' preparada.")
        db.cerrar()
        return

    if accion == "seed":
        db.insertar("clientes_simple", {"nombre": "Miguel", "apellidos": "Vargas", "email": "mivaro@gmail.com"})
        db.insertar("clientes_simple", {"nombre": "Betlem", "apellidos": "Codina", "email": "betcomar@gmail.com"})
        print("OK: seed en clientes_simple.")
        db.cerrar()
        return

    if accion == "list":
        print(db.seleccionar("clientes_simple"))
        db.cerrar()
        return

    if accion == "search":
        print(db.buscar("clientes_simple", "nombre", q))
        db.cerrar()
        return

def run_maorm(MAORM, accion: str, q: str):
    orm = MAORM(MYSQL.host, MYSQL.user, MYSQL.password, MYSQL.database, MYSQL.port)

    if accion == "init":
        orm.create_table_clientes()
        print("OK: tabla MAORM 'clientes' preparada.")
        orm.close()
        return

    if accion == "seed":
        clientes = [
            {
                "nombre": "Miguel Angel",
                "apellidos": "Vargas Rodriguez",
                "emails": [
                    {"tipo": "personal", "direcciones": ["gaming@miguelangelvargas.com", "mivaro@gmail.com"]},
                    {"tipo": "empresa", "direcciones": ["mivaro@rito.com"]}
                ]
            },
            {
                "nombre": "Betlem",
                "apellidos": "Codina Marquez",
                "emails": [
                    {"tipo": "personal", "direcciones": ["bet@betlemplaying.com", "betcomar@gmail.com"]},
                    {"tipo": "empresa", "direcciones": ["bet@comar.com"]}
                ]
            }
        ]
        orm.create_table_clientes()
        for c in clientes:
            orm.insert_cliente(c)
        print("OK: seed en clientes (emails JSON).")
        orm.close()
        return

    if accion == "list":
        datos = orm.fetch_clientes()
        print(json.dumps(datos, ensure_ascii=False, indent=2))
        orm.close()
        return

    if accion == "search":
        datos = orm.fetch_clientes()
        qlow = q.lower()
        filtradas = []
        for d in datos:
            raw = (d["nombre"] or "") + " " + (d["apellidos"] or "") + " " + json.dumps(d["emails"], ensure_ascii=False)
            if qlow in raw.lower():
                filtradas.append(d)
        print(json.dumps(filtradas, ensure_ascii=False, indent=2))
        orm.close()
        return

if __name__ == "__main__":
    main()

