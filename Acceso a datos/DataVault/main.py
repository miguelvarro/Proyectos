from config import ensure_dirs
from models import Registro
from storage import text_storage, binary_storage, hash_storage
from storage.image_storage import texto_a_imagen, imagen_a_texto
from storage.csv_storage import GestorCSV
from storage.filesystem_audit import imprimir_arbol

def main():
    ensure_dirs()

    # JSON
    notas = text_storage.cargar_notas()
    text_storage.agregar_nota(notas, "Miguel", "Matemáticas", 8.5)
    text_storage.agregar_nota(notas, "Betlem", "Física", 9.0)
    text_storage.guardar_notas(notas)

    # Pickle binario 
    clientes = binary_storage.demo_clientes(3)
    binary_storage.guardar_clientes(clientes)

    # Hash 
    personaje = {
        "nombre": "Naruto Uzumaki",
        "habilidad": "Uso del chakra del Kyūbi, Rasengan y Modo Sabio",
        "tipo": "Luchador",
        "personalidad": "Optimista, perseverante y leal",
        "importancia": "Protagonista de Naruto",
    }
    path_hash = hash_storage.guardar_personaje(personaje)

    # Imagen encode/decode
    registro = Registro.nuevo("Mensaje oculto", "Hola desde DataVault 👋").to_dict()
    img_path = texto_a_imagen(registro["contenido"], "mensaje.png")
    recuperado = imagen_a_texto(str(img_path))

    # CSV
    gestor = GestorCSV("personajes.csv")
    gestor.escribir(("Viper", "Veneno", "Humo"))
    ultima = gestor.leer_ultima()

    # Árbol del sistema
    print("\n=== Árbol de data/ ===")
    imprimir_arbol("data")

    # Resumen
    print("\n=== Resumen ===")
    print("Notas guardadas en data/secuencial/notas.json")
    print("Clientes guardados en data/binario/clientes.bin")
    print("Personaje guardado en:", path_hash)
    print("Imagen guardada en:", img_path)
    print("Texto recuperado de imagen:", recuperado)
    print("Última fila CSV:", ultima)

if __name__ == "__main__":
    main()

