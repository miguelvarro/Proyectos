📦 DataVault
Sistema avanzado de almacenamiento y auditoría de datos
📌 Descripción del proyecto

DataVault es un proyecto integrador de la asignatura Acceso a Datos cuyo objetivo es demostrar el dominio de múltiples técnicas de persistencia y gestión de información dentro de un único sistema coherente y modular.

El proyecto implementa un laboratorio práctico de almacenamiento que permite:

Escritura y lectura en modo texto (JSON)

Persistencia binaria con pickle

Almacenamiento basado en hash (MD5)

Codificación y descodificación de información en imágenes RGB

Persistencia tabular en CSV

Revisión y auditoría del árbol del sistema de archivos

El sistema genera evidencia real en la carpeta data/, demostrando el funcionamiento práctico de cada técnica.

🎯 Objetivos académicos cumplidos

Este proyecto demuestra:

✔ Lectura y escritura en múltiples formatos
✔ Persistencia estructurada en JSON
✔ Serialización binaria con pickle
✔ Uso de hashes para almacenamiento distribuido
✔ Diferencia entre almacenamiento secuencial vs hash
✔ Codificación y recuperación de información en imágenes
✔ Gestión de CSV
✔ Recorrido y análisis del sistema de archivos

🗂 Estructura del proyecto
DataVault/
│
├── main.py
├── config.py
├── models.py
│
├── storage/
│   ├── __init__.py
│   ├── text_storage.py
│   ├── binary_storage.py
│   ├── hash_storage.py
│   ├── image_storage.py
│   ├── csv_storage.py
│   └── filesystem_audit.py
│
└── data/
    ├── secuencial/
    ├── binario/
    ├── hash/
    ├── imagenes/
    └── csv/

🧠 Arquitectura del sistema

El proyecto está dividido en tres capas principales:

1️⃣ Configuración

config.py centraliza las rutas del sistema y asegura la existencia de las carpetas necesarias.

2️⃣ Modelo de datos

models.py define la clase Registro, que unifica el formato de datos utilizado en el sistema.

3️⃣ Módulos de almacenamiento (storage/)

Cada formato de persistencia está encapsulado en un módulo independiente:

text_storage.py → Gestión de notas en JSON

binary_storage.py → Persistencia binaria con pickle

hash_storage.py → Almacenamiento por hash MD5

image_storage.py → Codificación de texto en imágenes RGB

csv_storage.py → Gestión de archivos CSV

filesystem_audit.py → Recorrido y visualización del árbol de archivos

main.py actúa como orquestador del sistema.

🛠 Tecnologías utilizadas

Python 3

json

pickle

hashlib

csv

os

pathlib

dataclasses

Pillow (PIL) para tratamiento de imágenes

▶ Cómo ejecutar el proyecto
1️⃣ Instalar dependencias

Solo es necesaria Pillow:

pip install pillow

2️⃣ Ejecutar el sistema
python main.py

📂 Evidencias generadas

Tras la ejecución se crean automáticamente archivos en:

📄 JSON (modo texto)
data/secuencial/notas.json

📦 Binario (pickle)
data/binario/clientes.bin

🔐 Hash (MD5)
data/hash/<hash>.json

🖼 Imagen con información embebida
data/imagenes/mensaje.png

📊 CSV
data/csv/personajes.csv


Además, se muestra por consola el árbol del sistema de archivos generado.

🔍 Explicación técnica resumida
JSON (Modo texto)

Se utiliza para almacenar una lista de notas en formato estructurado legible y editable.

Pickle (Binario)

Permite serializar estructuras de datos complejas y almacenarlas eficientemente en binario.

Hash MD5

El nombre del archivo se genera a partir de un hash calculado sobre el contenido, demostrando almacenamiento por clave derivada.

Imagen RGB

El texto se convierte a bytes y se almacena en los canales RGB de cada píxel.
Se añade un encabezado de 4 bytes para guardar la longitud y permitir una decodificación exacta.

CSV

Permite almacenamiento tabular compatible con herramientas externas como Excel.

Auditoría del sistema

Se recorre la carpeta data/ usando os.walk, mostrando jerarquía y archivos generados.

🧪 Flujo de ejecución

Al ejecutar main.py:

Se crean las carpetas necesarias.

Se generan y guardan notas en JSON.

Se crean clientes demo y se guardan en binario.

Se guarda un personaje indexado por hash.

Se codifica un mensaje en una imagen y se recupera.

Se escribe y lee una fila CSV.

Se imprime el árbol del sistema de archivos.

Se muestra un resumen final.

📈 Valor añadido del proyecto

Este desarrollo no es una colección de ejercicios aislados, sino un sistema integrado que:

Unifica múltiples técnicas de acceso a datos.

Separa claramente código y persistencia.

Es modular y reutilizable.

Puede integrarse en sistemas mayores (ERP, backend, APIs).

👨‍💻 Autor

Proyecto desarrollado como trabajo integrador de la asignatura Acceso a Datos.
