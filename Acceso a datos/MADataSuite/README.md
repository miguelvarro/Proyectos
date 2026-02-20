# MADataSuite
Capa personalizada de conexión y acceso a datos (proyecto integrador).

Este proyecto integra en un único sistema:
- **MASQL**: motor SQL propio sobre ficheros CSV (bases=carpetas, tablas=csv).
- **MADB (Python)**: conector personalizado a MySQL (seleccionar/buscar/tablas).
- **MAORM (Python)**: ORM/Bridge ligero para tablas con columna JSON (emails).
- **MADB (PHP)**: versión PHP del conector (seleccionar/buscar/tablas) + demos.

## Estructura
- `python/engine/MASQL.py` -> motor propio tipo SQL
- `python/connectors/MADB.py` -> conector MySQL personalizado
- `python/orm/MAORM.py` -> ORM/Bridge con JSON
- `php/MADB.php` -> conector PHP
- `sql/schema_mysql.sql` -> tablas demo

## Requisitos
- Python 3
- MySQL funcionando
- Paquete Python:
  ```bash
  pip install mysql-connector-python

