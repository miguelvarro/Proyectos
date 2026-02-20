# Similitudes — ChromaDB + Ollama Embeddings + RAG (CLI)

Proyecto de “Entrenamiento de una inteligencia artificial semántica (ChromaDB - RAG)”:
- Persistencia vectorial con **ChromaDB**
- Embeddings generados con **Ollama** (por defecto `nomic-embed-text`)
- Búsqueda por similitud semántica
- Ingesta de documentos en lote (`ingest`)
- RAG real (`rag`): recuperación + respuesta con contexto vía Ollama Chat

---

## Requisitos

- Python 3.10+
- Ollama funcionando en local (por defecto):
  - `OLLAMA_HOST=http://localhost:11434`
- Modelos:
  - Embeddings: `nomic-embed-text`
  - Chat: por ejemplo `llama3.1:8b-instruct-q4_0`

Instalación:
```bash
pip install chromadb requests

## Ingesta (incluye PDF)

Soportado:
- `data/frases.json` (lista de objetos)
- `.txt`, `.md`
- `.pdf` (requiere `pip install pypdf`)

Ejemplos:

Crear template si `frases.json` está vacío:
```bash
python main.py template


