"""ChromaDB-backed vector store for F-Insight.

Two collections:
  1. `transactions`  — embeddings of every ingested narration.
       Metadata: merchant, category, source_file, date, txn_id (SQLite row id)
       Used for: semantic search, "find similar transactions"

  2. `corrections`   — user-confirmed narration→category pairs.
       Stored when a user manually changes a transaction's category.
       Used for: teaching the classifier from real corrections

The sentence-transformer model is shared with merchant_classifier.py via a
lazy singleton so it is only loaded once per process.

All methods degrade silently — if ChromaDB or the model fails, callers get
None / [] and the app continues without semantic features.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Optional

from logging_config import get_logger

logger = get_logger(__name__)

# Persist the Chroma DB next to the SQLite database file
_DB_PATH = str(Path(__file__).resolve().parent.parent / "chroma_db")

_lock = threading.Lock()
_store: Optional["VectorStore"] = None


def get_store() -> Optional["VectorStore"]:
    global _store
    if _store is None:
        with _lock:
            if _store is None:
                try:
                    _store = VectorStore()
                except Exception as exc:
                    logger.warning("ChromaDB store failed to initialise: %s", exc)
                    _store = None  # type: ignore[assignment]
    return _store


class VectorStore:
    def __init__(self):
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        self._client = chromadb.PersistentClient(
            path=_DB_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._txn_col  = self._client.get_or_create_collection("transactions")
        self._corr_col = self._client.get_or_create_collection("corrections")
        self._model = None
        logger.info("ChromaDB vector store ready at %s", _DB_PATH)

    # ── Lazy model load ───────────────────────────────────────────────────────

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Sentence-transformer model loaded for ChromaDB")
        return self._model

    def _embed(self, texts: list[str]) -> list[list[float]]:
        model = self._get_model()
        return model.encode(texts, normalize_embeddings=True).tolist()

    # ── Transaction collection ────────────────────────────────────────────────

    def add_transactions(self, transactions: list[dict]) -> None:
        """Embed and store a batch of transactions.

        Each dict must have: id (int), narration (str), merchant (str),
        category (str), source_file (str), date (str).
        Skips IDs already present (upsert by txn_id).
        """
        if not transactions:
            return
        try:
            texts = [t["narration"] for t in transactions]
            embeddings = self._embed(texts)
            ids = [f"txn_{t['id']}" for t in transactions]
            metadatas = [
                {
                    "merchant":    t.get("merchant", ""),
                    "category":    t.get("category", ""),
                    "source_file": t.get("source_file", ""),
                    "date":        str(t.get("date", "")),
                    "txn_id":      str(t["id"]),
                }
                for t in transactions
            ]
            self._txn_col.upsert(ids=ids, embeddings=embeddings,
                                  documents=texts, metadatas=metadatas)
            logger.debug("ChromaDB: upserted %d transactions", len(transactions))
        except Exception as exc:
            logger.warning("ChromaDB add_transactions failed: %s", exc)

    def search_similar(self, narration: str, n: int = 5) -> list[dict]:
        """Find the n most semantically similar stored transactions.

        Returns list of dicts: {narration, merchant, category, date, score}
        """
        try:
            count = self._txn_col.count()
            if count == 0:
                return []
            vec = self._embed([narration])
            results = self._txn_col.query(
                query_embeddings=vec,
                n_results=min(n, count),
                include=["documents", "metadatas", "distances"],
            )
            out = []
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0],
            ):
                out.append({
                    "narration": doc,
                    "merchant":  meta.get("merchant", ""),
                    "category":  meta.get("category", ""),
                    "date":      meta.get("date", ""),
                    "score":     round(1 - dist, 3),  # cosine distance → similarity
                })
            return out
        except Exception as exc:
            logger.warning("ChromaDB search_similar failed: %s", exc)
            return []

    def update_transaction_category(self, txn_id: int, category: str) -> None:
        """Update the stored category metadata when user manually corrects it."""
        try:
            chroma_id = f"txn_{txn_id}"
            existing = self._txn_col.get(ids=[chroma_id], include=["metadatas"])
            if existing and existing["metadatas"]:
                meta = existing["metadatas"][0]
                meta["category"] = category
                self._txn_col.update(ids=[chroma_id], metadatas=[meta])
        except Exception as exc:
            logger.warning("ChromaDB update_transaction_category failed: %s", exc)

    # ── Corrections collection ────────────────────────────────────────────────

    def add_correction(self, narration: str, category: str, merchant: str = "") -> None:
        """Store a user-confirmed narration→category correction.

        These are retrieved during categorization to override the rule-based result
        for narrations that are semantically very close to a stored correction.
        """
        try:
            import hashlib
            key = hashlib.md5(narration.lower().strip().encode()).hexdigest()
            vec = self._embed([narration])
            self._corr_col.upsert(
                ids=[key],
                embeddings=vec,
                documents=[narration],
                metadatas=[{"category": category, "merchant": merchant}],
            )
            logger.debug("ChromaDB: stored correction '%s' → %s", narration[:60], category)
        except Exception as exc:
            logger.warning("ChromaDB add_correction failed: %s", exc)

    def find_correction(self, narration: str, threshold: float = 0.90) -> Optional[str]:
        """Return a previously-corrected category if a very similar narration exists.

        threshold=0.90 means 90% cosine similarity — only exact-ish matches apply.
        Returns the category string, or None if no confident match found.
        """
        try:
            count = self._corr_col.count()
            if count == 0:
                return None
            vec = self._embed([narration])
            results = self._corr_col.query(
                query_embeddings=vec,
                n_results=1,
                include=["metadatas", "distances"],
            )
            if not results["distances"][0]:
                return None
            distance = results["distances"][0][0]
            similarity = 1 - distance
            if similarity >= threshold:
                return results["metadatas"][0][0].get("category")
            return None
        except Exception as exc:
            logger.warning("ChromaDB find_correction failed: %s", exc)
            return None

    def stats(self) -> dict:
        try:
            return {
                "transactions": self._txn_col.count(),
                "corrections":  self._corr_col.count(),
                "db_path":      _DB_PATH,
            }
        except Exception:
            return {"transactions": 0, "corrections": 0, "db_path": _DB_PATH}
