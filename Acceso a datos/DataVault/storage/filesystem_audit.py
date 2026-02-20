import os
from pathlib import Path

def imprimir_arbol(ruta: str) -> None:
    base = Path(ruta).resolve()
    base_str = str(base)

    for directorio, subdirectorios, archivos in os.walk(base):
        nivel = directorio.replace(base_str, "").count(os.sep)

        nombre_dir = Path(directorio).name or str(base)
        print("  " * nivel + "└📁" + nombre_dir)

        for sub in subdirectorios:
            print("  " * (nivel + 1) + "└📁" + sub)

        for archivo in archivos:
            print("  " * (nivel + 1) + "├📄" + archivo)

