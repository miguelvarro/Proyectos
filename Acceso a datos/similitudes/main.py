# main.py
from __future__ import annotations

import argparse
import json
import os
import uuid
from pathlib import Path
from typing import Any

import requests

from src.store import SimilaritiesStore



# Utils

def parse_where(where_str: str | None) -> dict | None:
    """
    Recibe JSON tipo: '{"autor":"Einstein"}'
    PowerShell: usa comillas simples por fuera:
      --where '{"source":"apuntes.pdf"}'
    """
    if not where_str:
        return None
    try:
        data = json.loads(where_str)
        if not isinstance(data, dict):
            raise ValueError
        return data
    except Exception:
        raise SystemExit('ERROR: --where debe ser JSON válido, ej: \'{"autor":"Einstein"}\'')


def get_store(args) -> SimilaritiesStore:
    return SimilaritiesStore(
        persist_dir=args.db,
        collection_name=args.collection,
        embed_model=args.embed_model,
    )


def normalize_tags(tags: Any) -> str:
    """
    Chroma metadata no permite listas => guardamos tags como CSV.
    tags puede venir como "a,b" o ["a","b"] o None.
    """
    if tags is None:
        return ""
    if isinstance(tags, list):
        return ",".join([str(t).strip() for t in tags if str(t).strip()])
    s = str(tags).strip()
    if not s:
        return ""
    return ",".join([t.strip() for t in s.split(",") if t.strip()])


def tags_contains(meta_tags_csv: str, wanted_tag: str) -> bool:
    """
    Filtro robusto para tags guardados como CSV.
    """
    if not wanted_tag:
        return True
    wanted = wanted_tag.strip().lower()
    if not wanted:
        return True
    have = [t.strip().lower() for t in (meta_tags_csv or "").split(",") if t.strip()]
    return wanted in have


def chunk_text(text: str, max_chars: int = 900, overlap: int = 120) -> list[str]:
    """
    Chunking simple por caracteres con solape (para txt/md/pdf).
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    chunks: list[str] = []
    i = 0
    while i < len(text):
        end = min(i + max_chars, len(text))
        ch = text[i:end].strip()
        if ch:
            chunks.append(ch)
        if end == len(text):
            break
        i = max(0, end - overlap)
    return chunks


def ollama_chat(model: str, messages: list[dict], timeout: int = 600) -> str:
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    r = requests.post(
        f"{host}/api/chat",
        json={"model": model, "messages": messages, "stream": False},
        timeout=timeout,
    )
    r.raise_for_status()
    payload = r.json()
    return (payload.get("message") or {}).get("content", "")


def ollama_json(model: str, messages: list[dict], timeout: int = 600) -> dict:
    """
    Pide JSON. Si falla, devuelve {"ok": False, "raw": "..."}.
    """
    txt = (ollama_chat(model=model, messages=messages, timeout=timeout) or "").strip()
    try:
        start = txt.find("{")
        end = txt.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(txt[start:end + 1])
    except Exception:
        pass
    return {"ok": False, "raw": txt}


def rerank_candidates_llm(chat_model: str, question: str, candidates: list[dict], top_k: int) -> list[dict]:
    """
    candidates: [{id, document, metadata, distance}]
    Devuelve lista ordenada por score desc.
    """
    packed = []
    for c in candidates:
        doc = (c.get("document") or "").strip()
        if len(doc) > 900:
            doc = doc[:900] + "…"
        packed.append({
            "id": c.get("id"),
            "distance": c.get("distance"),
            "document": doc,
            "metadata": c.get("metadata") or {},
        })

    system = (
        "Eres un evaluador de relevancia para RAG. "
        "Dada una pregunta y varios fragmentos, asigna un score 0-10 a cada fragmento "
        "según cuánto ayuda a responder la pregunta usando SOLO ese fragmento. "
        "Devuelve SOLO JSON: {\"ranked\":[{\"id\":\"...\",\"score\":0-10}, ...]}"
    )

    user = {"question": question, "candidates": packed}

    out = ollama_json(
        model=chat_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
        timeout=600,
    )

    ranked = out.get("ranked") if isinstance(out, dict) else None
    if not ranked or not isinstance(ranked, list):
        return candidates[:top_k]

    score_map: dict[str, float] = {}
    for r in ranked:
        try:
            score_map[str(r["id"])] = float(r["score"])
        except Exception:
            continue

    def key_fn(c):
        cid = str(c.get("id"))
        if cid in score_map:
            # score mayor mejor; distancia menor mejor
            return (score_map[cid], -float(c.get("distance") or 999))
        return (-1.0, -float(c.get("distance") or 999))

    sorted_cands = sorted(candidates, key=key_fn, reverse=True)
    return sorted_cands[:top_k]


def eval_answer_llm(chat_model: str, question: str, answer: str, sources: list[dict]) -> dict:
    """
    Evalúa groundedness y calidad. IMPORTANTE: manda también el texto de las fuentes.
    """
    system = (
        "Eres un evaluador de calidad de un sistema RAG. "
        "Evalúa si la respuesta está soportada por las fuentes. "
        "Devuelve SOLO JSON con:\n"
        "{"
        "\"groundedness\":0-10,"
        "\"completeness\":0-10,"
        "\"clarity\":0-10,"
        "\"uses_sources\":true/false,"
        "\"hallucinations\":true/false,"
        "\"notes\":\"...\""
        "}"
    )

    payload = {
        "question": question,
        "answer": answer,
        "sources": [
            {
                "id": s.get("id"),
                "metadata": s.get("metadata"),
                "document": (s.get("document") or "")[:1200],
            }
            for s in sources
        ],
    }

    return ollama_json(
        model=chat_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
        timeout=600,
    )


def ensure_template_frases_json(path: Path) -> dict:
    """
    Si frases.json está vacío o no existe, escribe un template mínimo.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        try:
            raw = path.read_text(encoding="utf-8").strip()
            if raw:
                return {"ok": True, "note": "frases.json ya tiene contenido", "path": str(path)}
        except Exception:
            pass

    sample = [
        {
            "text": "La imaginación es más importante que el conocimiento",
            "autor": "Einstein",
            "tags": ["ciencia", "creatividad"],
            "source": "frases.json",
        },
        {
            "text": "RAG (Retrieval-Augmented Generation) combina recuperación semántica y generación: primero recupera contexto y luego genera una respuesta apoyándose en ese contexto.",
            "autor": "Profe",
            "tags": ["apuntes", "rag", "tema1"],
            "source": "frases.json",
        }
    ]
    path.write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "note": "Template creado en frases.json", "path": str(path)}



# Comandos básicos

def cmd_init(args):
    store = get_store(args)
    print(json.dumps(store.init(), indent=2, ensure_ascii=False))


def cmd_add(args):
    store = get_store(args)

    text = (args.text or "").strip()
    if not text:
        raise SystemExit("ERROR: --text no puede estar vacío")

    doc_id = (args.id or "").strip() or str(uuid.uuid4())

    metadata: dict[str, Any] = {}
    if args.autor:
        metadata["autor"] = args.autor.strip()
    if args.source:
        metadata["source"] = args.source.strip()

    tags_csv = normalize_tags(args.tags)
    if tags_csv:
        metadata["tags"] = tags_csv

    out = store.add_text(text=text, doc_id=doc_id, metadata=metadata)
    print(json.dumps(out, indent=2, ensure_ascii=False))


def cmd_query(args):
    store = get_store(args)
    where = parse_where(args.where)

    res = store.query(text=args.q, top_k=args.k, where=where)

    out = {
        "ok": True,
        "query": args.q,
        "top_k": args.k,
        "where": where,
        "results": [
            {
                "id": res.ids[i],
                "distance": res.distances[i],
                "document": res.documents[i],
                "metadata": res.metadatas[i],
            }
            for i in range(len(res.ids))
        ],
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))


def cmd_stats(args):
    store = get_store(args)
    print(json.dumps(store.stats(), indent=2, ensure_ascii=False))


def cmd_delete(args):
    store = get_store(args)
    where = parse_where(args.where)
    if not where:
        raise SystemExit('ERROR: delete requiere --where \'{"autor":"Einstein"}\'')
    out = store.delete_where(where=where)
    print(json.dumps(out, indent=2, ensure_ascii=False))


def cmd_reset(args):
    store = get_store(args)
    print(json.dumps(store.reset(), indent=2, ensure_ascii=False))



# INGEST

def ingest_json_list(store: SimilaritiesStore, path: Path, default_source: str = "") -> dict:
    """
    JSON lista de objetos con:
      text (obligatorio), autor/source/tags (opcionales)
    """
    try:
        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            return {"ok": True, "inserted": 0, "note": "JSON vacío", "path": str(path)}
        data = json.loads(raw)
    except Exception as e:
        return {"ok": False, "error": f"JSON inválido: {e}", "path": str(path)}

    if not isinstance(data, list):
        return {"ok": False, "error": "El JSON debe ser una lista de objetos", "path": str(path)}

    inserted = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue

        autor = str(item.get("autor") or "").strip()
        source = str(item.get("source") or default_source or path.name).strip()
        tags_csv = normalize_tags(item.get("tags"))

        chunks = chunk_text(text, max_chars=900, overlap=120)
        for idx, ch in enumerate(chunks):
            meta: dict[str, Any] = {"chunk": idx, "chunks_total": len(chunks)}
            if autor:
                meta["autor"] = autor
            if source:
                meta["source"] = source
            if tags_csv:
                meta["tags"] = tags_csv

            store.add_text(text=ch, doc_id=str(uuid.uuid4()), metadata=meta)
            inserted += 1

    return {"ok": True, "inserted": inserted, "path": str(path)}


def ingest_text_file(store: SimilaritiesStore, path: Path, autor: str = "", tags: str = "", source: str = "") -> dict:
    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not text:
        return {"ok": True, "inserted": 0, "path": str(path), "note": "archivo vacío"}

    tags_csv = normalize_tags(tags)
    src = source or path.name

    chunks = chunk_text(text, max_chars=900, overlap=120)
    inserted = 0
    for idx, ch in enumerate(chunks):
        meta: dict[str, Any] = {"source": src, "chunk": idx, "chunks_total": len(chunks)}
        if autor:
            meta["autor"] = autor
        if tags_csv:
            meta["tags"] = tags_csv
        store.add_text(text=ch, doc_id=str(uuid.uuid4()), metadata=meta)
        inserted += 1

    return {"ok": True, "inserted": inserted, "path": str(path), "chunks": len(chunks)}


def ingest_pdf_file(store: SimilaritiesStore, path: Path, autor: str = "", tags: str = "", source: str = "") -> dict:
    """
    Requiere: pip install pypdf
    """
    try:
        from pypdf import PdfReader
    except Exception:
        return {"ok": False, "error": "Falta dependencia pypdf. Instala: pip install pypdf", "path": str(path)}

    reader = PdfReader(str(path))
    all_text = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        t = t.strip()
        if t:
            all_text.append(t)

    text = "\n\n".join(all_text).strip()
    if not text:
        return {"ok": True, "inserted": 0, "path": str(path), "note": "PDF sin texto extraíble"}

    tags_csv = normalize_tags(tags)
    src = source or path.name

    chunks = chunk_text(text, max_chars=1200, overlap=160)
    inserted = 0
    for idx, ch in enumerate(chunks):
        meta: dict[str, Any] = {
            "source": src,
            "chunk": idx,
            "chunks_total": len(chunks),
            "type": "pdf",
        }
        if autor:
            meta["autor"] = autor
        if tags_csv:
            meta["tags"] = tags_csv

        store.add_text(text=ch, doc_id=str(uuid.uuid4()), metadata=meta)
        inserted += 1

    return {"ok": True, "inserted": inserted, "path": str(path), "chunks": len(chunks)}


def cmd_ingest(args):
    store = get_store(args)
    p = Path(args.path)

    if not p.exists():
        raise SystemExit(f"ERROR: no existe --path {p}")

    results = []

    def handle_file(fp: Path):
        ext = fp.suffix.lower()
        if ext == ".json":
            return ingest_json_list(store, fp, default_source=args.source or fp.name)
        if ext in (".txt", ".md"):
            return ingest_text_file(store, fp, autor=args.autor, tags=args.tags, source=args.source or fp.name)
        if ext == ".pdf":
            return ingest_pdf_file(store, fp, autor=args.autor, tags=args.tags, source=args.source or fp.name)
        return None

    if p.is_file():
        out = handle_file(p)
        if out is None:
            raise SystemExit("ERROR: ingest soporta .json, .txt, .md, .pdf")
        results.append(out)
    else:
        for fp in sorted(p.rglob("*")):
            if fp.is_file():
                out = handle_file(fp)
                if out is not None:
                    results.append(out)

    print(json.dumps({"ok": True, "results": results}, indent=2, ensure_ascii=False))



# TEMPLATE

def cmd_template(args):
    path = Path(args.path)
    out = ensure_template_frases_json(path)
    print(json.dumps(out, indent=2, ensure_ascii=False))



# RAG

def cmd_rag(args):
    store = get_store(args)

    where = parse_where(args.where)
    if args.autor:
        where = dict(where or {})
        where["autor"] = args.autor.strip()

    k_fetch = args.k_fetch if args.k_fetch else (args.k * 5)
    if k_fetch < args.k:
        k_fetch = args.k

    res = store.query(text=args.q, top_k=k_fetch, where=where)

    candidates = []
    for i in range(len(res.ids)):
        meta = res.metadatas[i] or {}
        if args.tag and not tags_contains(meta.get("tags", ""), args.tag):
            continue
        candidates.append({
            "id": res.ids[i],
            "document": res.documents[i],
            "metadata": meta,
            "distance": res.distances[i],
        })


    if args.rerank and candidates:
        chosen = rerank_candidates_llm(
            chat_model=args.model,
            question=args.q,
            candidates=candidates,
            top_k=args.k,
        )
    else:
        chosen = candidates[: args.k]


    context_parts = []
    sources = []
    for c in chosen:
        doc = (c["document"] or "").strip()
        context_parts.append(f"[{c['id']}]\n{doc}")
        sources.append({
            "id": c["id"],
            "metadata": c["metadata"],
            "distance": c["distance"],
            "document": doc,  # para eval
        })

    context = "\n\n---\n\n".join(context_parts) if context_parts else "(sin contexto)"

    strict_rule = (
        "MODO ESTRICTO: si el contexto no contiene la respuesta, responde exactamente: "
        "\"No está en el contexto.\""
    ) if args.strict else ""

    system_prompt = (
        "Eres un asistente útil. Responde usando SOLO el contexto proporcionado.\n"
        "- Si el contexto contiene una definición literal o una frase que responde, repítela o parafrasea MUY cerca.\n"
        "- Si hay varias citas relacionadas, resume en 1-3 bullets SOLO lo que se desprende de esas citas.\n"
        "- No añadas conocimiento externo.\n"
        "- Si falta información, di exactamente qué falta.\n"
        f"{strict_rule}\n"
        "Al final añade EXACTAMENTE:\n"
        "Fuentes: [id1], [id2], ...\n"
        "SOLO ids (no títulos, no nombres)."
    ).strip()

    user_prompt = f"Pregunta:\n{args.q}\n\nContexto:\n{context}"

    answer = ollama_chat(
        model=args.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        timeout=600,
    )

    out = {
        "ok": True,
        "question": args.q,
        "chat_model": args.model,
        "embed_model": args.embed_model,
        "top_k": args.k,
        "k_fetch": k_fetch,
        "where": where,
        "tag_filter": args.tag or "",
        "rerank": bool(args.rerank),
        "strict": bool(args.strict),
        "answer": answer,
        "sources": [{"id": s["id"], "metadata": s["metadata"], "distance": s["distance"]} for s in sources],
    }

    if args.eval:
        out["eval"] = eval_answer_llm(args.model, args.q, answer, sources)

    print(json.dumps(out, indent=2, ensure_ascii=False))



# TRAIN 

def cmd_train(args):
    """
    Entrenamiento intensivo:
      1) template si data/frases.json vacío
      2) ingest data/
      3) stats
    """
    store = get_store(args)

    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    frases_path = data_dir / "frases.json"
    template_out = ensure_template_frases_json(frases_path)
    print(json.dumps({"ok": True, "step": "template", "result": template_out}, indent=2, ensure_ascii=False))

    class DummyArgs:
        pass

    dummy = DummyArgs()
    dummy.db = args.db
    dummy.collection = args.collection
    dummy.embed_model = args.embed_model
    dummy.path = str(data_dir)
    dummy.autor = args.autor
    dummy.tags = args.tags
    dummy.source = args.source

    cmd_ingest(dummy)

    print(json.dumps({"ok": True, "step": "stats", "result": store.stats()}, indent=2, ensure_ascii=False))


# Parser

def build_parser():
    p = argparse.ArgumentParser(
        prog="similitudes",
        description="CLI: similitudes semánticas + ingest (json/txt/md/pdf) + RAG (Ollama + ChromaDB)",
    )
    p.add_argument("--db", default="chroma_db", help="Carpeta de persistencia Chroma")
    p.add_argument("--collection", default="similitudes", help="Nombre de la colección")
    p.add_argument("--embed-model", default="nomic-embed-text", help="Modelo embeddings en Ollama")

    sp = p.add_subparsers(dest="cmd", required=True)

    sp.add_parser("init", help="Inicializa la colección").set_defaults(fn=cmd_init)

    s_add = sp.add_parser("add", help="Añade un texto")
    s_add.add_argument("--text", required=True)
    s_add.add_argument("--id", default="")
    s_add.add_argument("--autor", default="")
    s_add.add_argument("--source", default="")
    s_add.add_argument("--tags", default="")
    s_add.set_defaults(fn=cmd_add)

    s_query = sp.add_parser("query", help="Consulta por similitud")
    s_query.add_argument("--q", required=True)
    s_query.add_argument("--k", type=int, default=5)
    s_query.add_argument("--where", default="")
    s_query.set_defaults(fn=cmd_query)

    sp.add_parser("stats", help="Stats").set_defaults(fn=cmd_stats)

    s_del = sp.add_parser("delete", help="Borra por where")
    s_del.add_argument("--where", required=True)
    s_del.set_defaults(fn=cmd_delete)

    sp.add_parser("reset", help="Resetea la colección").set_defaults(fn=cmd_reset)

    s_ing = sp.add_parser("ingest", help="Ingresa archivos/carpeta")
    s_ing.add_argument("--path", required=True)
    s_ing.add_argument("--autor", default="")
    s_ing.add_argument("--source", default="")
    s_ing.add_argument("--tags", default="")
    s_ing.set_defaults(fn=cmd_ingest)

    s_tpl = sp.add_parser("template", help="Crea template data/frases.json si está vacío")
    s_tpl.add_argument("--path", default="data/frases.json")
    s_tpl.set_defaults(fn=cmd_template)

    s_rag = sp.add_parser("rag", help="RAG: retrieval + generación")
    s_rag.add_argument("--q", required=True)
    s_rag.add_argument("--k", type=int, default=5)
    s_rag.add_argument("--model", default="llama3.1:8b-instruct-q4_0")
    s_rag.add_argument("--where", default="")
    s_rag.add_argument("--autor", default="")
    s_rag.add_argument("--tag", default="")
    s_rag.add_argument("--rerank", action="store_true")
    s_rag.add_argument("--eval", action="store_true")
    s_rag.add_argument("--strict", action="store_true")
    s_rag.add_argument("--k-fetch", dest="k_fetch", type=int, default=0)
    s_rag.set_defaults(fn=cmd_rag)

    s_train = sp.add_parser("train", help="Template + ingest data/ + stats")
    s_train.add_argument("--data-dir", default="data")
    s_train.add_argument("--autor", default="")
    s_train.add_argument("--source", default="")
    s_train.add_argument("--tags", default="")
    s_train.set_defaults(fn=cmd_train)

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

