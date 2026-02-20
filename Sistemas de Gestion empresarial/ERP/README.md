# Proyecto ERP en clase (versión mini)

Este proyecto agrupa:
- ERP base hecho en clase con módulo Kanban.
- Instalador MySQL que importa el esquema/datos desde un `.sql`.
- Mapeo de XML (XML → HTML) con Flask (Python).
- “IA SQL” (modo mini): una interfaz de chat que traduce preguntas típicas a consultas SELECT y muestra resultados.

## Requisitos
- XAMPP (Apache + MySQL) o equivalente.
- PHP 8+ recomendado.
- Python 3.10+ (para `xml-mapper/`) y `pip install flask`.

---

## 1) Instalación de la base de datos (MySQL)
1. En phpMyAdmin (o MySQL CLI) crea la base de datos:
   - `erp`
2. Crea un usuario (ejemplo):
   - usuario: `erp`
   - contraseña: `erp`
   - permisos sobre la BD `erp` (CREATE/ALTER/INSERT/SELECT).
3. Abre el instalador en el navegador:
   - `http://localhost/Proyecto-ERP-Clase/erp/instalador/index.php`
4. Rellena credenciales y ejecuta.
   - El instalador importa: `erp/basededatos/instalacion.sql`.

> Si ya tenías tablas, puede dar avisos/errores por “tabla ya existe”. En un entorno limpio, debería entrar sin problemas.

---

## 2) ERP (frontend)
- Entrada principal:
  - `http://localhost/Proyecto-ERP-Clase/erp/frontend/index.php`

### Login
- Usuario/clave por defecto (según `instalacion.sql`):
  - usuario: `miguel`
  - contraseña: `miguel`

### Kanban
- `http://localhost/Proyecto-ERP-Clase/erp/frontend/kanban/index.php`
- Guardado “server-side”:
  - El botón “Guardar en servidor” llama a `erp/backend/savekanban.php` y guarda en SQLite.

---

## 3) Mapeo XML (XML → HTML)
En terminal:

```bash
cd xml-mapper
pip install flask
python servidor.py

