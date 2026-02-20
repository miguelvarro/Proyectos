from orm.MAORM import MAORM
from config import MYSQL
import json

def run():
    orm = MAORM(MYSQL.host, MYSQL.user, MYSQL.password, MYSQL.database, MYSQL.port)
    orm.create_table_clientes()

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

    for c in clientes:
        orm.insert_cliente(c)

    datos = orm.fetch_clientes()
    for d in datos:
        print(json.dumps(d, ensure_ascii=False, indent=2))

    orm.close()

if __name__ == "__main__":
    run()

