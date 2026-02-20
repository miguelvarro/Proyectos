# src/store.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import chromadb
from chromadb.config import Settings

from .embedder import ollama_embed


@dataclass
class QueryResult:
    ids: list[str]
    documents: list[str]
    metadatas: list[dict]
    distances: list[float]


class SimilaritiesStore:
    def __init__(
        self,
        persist_dir: str = "chroma_db",
        collection_name: str = "similitudes",
        embed_model: str = "nomic-embed-text",
    ):
        self.persist_dir = Path(persist_dir)
        self.collection_name = collection_name
        self.embed_model = embed_model

        self.client = chromadb.PersistentClient(
            path=str(self.persist_dir),
            settings=Settings(anonymized_telemetry=False),
        )

        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def init(self) -> dict[str, Any]:
        return {
            "ok": True,
            "persist_dir": str(self.persist_dir),
            "collection": self.collection_name,
            "embed_model": self.embed_model,
        }

    def add_text(
        self,
        text: str,
        doc_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        emb = ollama_embed(text, model=self.embed_model)
        self.collection.add(
            ids=[doc_id],
            documents=[text],
            embeddings=[emb],
            metadatas=[metadata or {}],
        )
        return {"ok": True, "id": doc_id}

    def query(
        self,
        text: str,
        top_k: int = 5,
        where: dict[str, Any] | None = None,
    ) -> QueryResult:
        emb = ollama_embed(text, model=self.embed_model)
        res = self.collection.query(
            query_embeddings=[emb],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]

        return QueryResult(ids=ids, documents=docs, metadatas=metas, distances=dists)

    def stats(self) -> dict[str, Any]:
        got = self.collection.get(include=["metadatas"])
        n = len(got.get("ids", []))

        by_author: dict[str, int] = {}
        for m in got.get("metadatas", []) or []:
            a = (m or {}).get("autor")
            if a:
                by_author[a] = by_author.get(a, 0) + 1

        return {
            "ok": True,
            "collection": self.collection_name,
            "count": n,
            "by_author": by_author,
        }

    def delete_where(self, where: dict[str, Any]) -> dict[str, Any]:
        self.collection.delete(where=where)
        return {"ok": True, "deleted_where": where}

    def reset(self) -> dict[str, Any]:
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        return {"ok": True, "reset": True, "collection": self.collection_name}

