# src/embedder.py
from __future__ import annotations

import os
import time
from typing import Optional

import requests

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")


class OllamaEmbedError(RuntimeError):
    pass


def ollama_embed(
    text: str,
    model: Optional[str] = None,
    timeout: int = 60,
    retries: int = 3,
    backoff_seconds: float = 0.7,
) -> list[float]:
    """
    Genera embedding usando Ollama /api/embeddings.

    - retries: reintentos ante errores temporales (Ollama arrancando, timeout, 5xx)
    - backoff_seconds: espera incremental entre reintentos
    """
    text = (text or "").strip()
    if not text:
        raise ValueError("Texto vacío para embedding")

    m = (model or DEFAULT_EMBED_MODEL).strip()
    if not m:
        raise ValueError("Modelo de embedding vacío")

    url = f"{OLLAMA_HOST}/api/embeddings"
    payload = {"model": m, "prompt": text}

    last_err: Exception | None = None

    for attempt in range(retries + 1):
        try:
            r = requests.post(url, json=payload, timeout=timeout)
            # Si Ollama responde 404 por modelo no descargado u otro error, lo queremos ver claro
            if r.status_code >= 400:
                # intenta extraer json de error
                try:
                    err_payload = r.json()
                except Exception:
                    err_payload = {"error": r.text[:400]}
                raise OllamaEmbedError(f"HTTP {r.status_code} en /api/embeddings: {err_payload}")

            data = r.json()
            emb = data.get("embedding")
            if not isinstance(emb, list) or not emb:
                raise OllamaEmbedError(f"Respuesta inesperada de embeddings: {data}")

            # Validación suave: floats
            try:
                return [float(x) for x in emb]
            except Exception:
                raise OllamaEmbedError("El embedding no contiene números válidos")

        except (requests.Timeout, requests.ConnectionError) as e:
            last_err = e
        except OllamaEmbedError as e:
            # Si es un error del servidor/modelo, normalmente no sirve reintentar mucho,
            # pero dejamos 1 reintento por si era warming-up.
            last_err = e
        except Exception as e:
            last_err = e

        # Si aún quedan reintentos, espera con backoff
        if attempt < retries:
            time.sleep(backoff_seconds * (attempt + 1))

    raise OllamaEmbedError(f"No se pudo generar embedding tras {retries+1} intentos. Último error: {last_err}")

