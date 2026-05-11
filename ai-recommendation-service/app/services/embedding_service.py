"""Product-text → vector embedding service.

Two backends:
  - SentenceTransformer (sentence-transformers/all-MiniLM-L6-v2 by default)
    is the production path described in the spec. Yields 384-dim
    semantic vectors that capture e-commerce intent ("milk" ~ "dairy
    drink").
  - TF-IDF (sklearn) is a deterministic CPU-only fallback. Used when:
      * `EMBEDDING_BACKEND=tfidf` is forced (CI, lightweight envs).
      * SentenceTransformer fails to import / download (no network,
        offline build, etc.).
    Fallback keeps the service alive — recommendations degrade in
    quality but never 5xx.

Design notes
------------
- Embeddings are L2-normalised at insert time so similarity is a
  single matrix-multiply (`utils.similarity.cosine_similarity_matrix`).
- A per-process content-hash cache avoids re-embedding the same
  product on every catalogue refresh.
- Model load is lazy + idempotent — the first call pays the latency,
  subsequent calls are O(1).
"""

from __future__ import annotations

import asyncio
import hashlib
import threading
from typing import Dict, List, Optional, Sequence

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.utils.similarity import normalize, to_float32

log = get_logger(__name__)


def _content_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


class EmbeddingBackend:
    """Strategy interface — both ST and TF-IDF implement this."""

    name: str = "abstract"

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        raise NotImplementedError


class SentenceTransformerBackend(EmbeddingBackend):
    """sentence-transformers/all-MiniLM-L6-v2.

    Imported lazily so the rest of the service can run without
    sentence_transformers being available (e.g. CI containers using
    the TF-IDF fallback).
    """

    name = "sentence_transformers"

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer  # noqa: WPS433

        log.info("EMBEDDING BACKEND - loading model=%s", model_name)
        self._model = SentenceTransformer(model_name)
        log.info("EMBEDDING BACKEND - loaded model=%s", model_name)

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        vectors = self._model.encode(
            list(texts),
            convert_to_numpy=True,
            normalize_embeddings=False,
            show_progress_bar=False,
        )
        return vectors.astype(np.float32, copy=False)


class TfIdfBackend(EmbeddingBackend):
    """Fallback: TF-IDF n-gram cosine similarity.

    Vocabulary is fit on the catalogue snapshot — every catalogue
    refresh re-fits, so new product terms aren't ignored. Output is
    dense float32 to keep the matrix-multiply path identical to the
    SentenceTransformer one.
    """

    name = "tfidf"

    def __init__(self) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: WPS433

        self._vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_features=4096,
        )
        self._fitted = False
        self._fit_corpus: List[str] = []

    def fit(self, corpus: Sequence[str]) -> None:
        self._fit_corpus = list(corpus)
        if self._fit_corpus:
            self._vectorizer.fit(self._fit_corpus)
            self._fitted = True

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        if not self._fitted:
            self.fit(texts)
        if not texts:
            return np.zeros((0, 1), dtype=np.float32)
        sparse = self._vectorizer.transform(list(texts))
        dense = sparse.toarray().astype(np.float32, copy=False)
        return dense


class EmbeddingService:
    """Catalogue-wide embedding store.

    Responsibilities
    ----------------
    1. Pick a backend (auto / sentence_transformers / tfidf).
    2. Maintain a process-local cache: product_id → (content_hash, vector).
    3. Recompute only what's changed when the catalogue refreshes.
    4. Expose an L2-normalised matrix for similarity computation.
    """

    def __init__(self, backend: Optional[EmbeddingBackend] = None) -> None:
        self._settings = get_settings()
        self._backend: Optional[EmbeddingBackend] = backend
        self._lock = threading.Lock()
        self._cache: Dict[int, tuple[str, np.ndarray]] = {}

    @property
    def backend_name(self) -> str:
        return self._backend.name if self._backend is not None else "uninitialised"

    def _ensure_backend(self) -> EmbeddingBackend:
        if self._backend is not None:
            return self._backend
        with self._lock:
            if self._backend is not None:
                return self._backend
            preference = self._settings.embedding_backend
            if preference == "tfidf":
                self._backend = TfIdfBackend()
            elif preference == "sentence_transformers":
                self._backend = SentenceTransformerBackend(self._settings.embedding_model_name)
            else:  # auto
                try:
                    self._backend = SentenceTransformerBackend(self._settings.embedding_model_name)
                except Exception as exc:
                    log.warning(
                        "EMBEDDING BACKEND - sentence-transformers unavailable, "
                        "falling back to TF-IDF reason=%s",
                        exc,
                    )
                    self._backend = TfIdfBackend()
            return self._backend

    # ------------------------------------------------------------------ #
    # Encoding
    # ------------------------------------------------------------------ #

    async def encode_catalog(self, products) -> np.ndarray:
        """Return an L2-normalised matrix aligned with `products` order."""
        return await asyncio.to_thread(self._encode_catalog_sync, products)

    def _encode_catalog_sync(self, products) -> np.ndarray:
        if not products:
            return np.zeros((0, 1), dtype=np.float32)

        backend = self._ensure_backend()
        texts = [p.text_for_embedding() for p in products]

        # TF-IDF needs to refit when vocabulary may have shifted —
        # cheaper than maintaining incremental vocabulary state.
        if isinstance(backend, TfIdfBackend):
            backend.fit(texts)
            self._cache.clear()  # refit invalidates cached vectors

        # Identify which products need fresh embeddings.
        to_encode_idx: List[int] = []
        to_encode_text: List[str] = []
        for i, (p, t) in enumerate(zip(products, texts)):
            content_hash = _content_hash(t)
            cached = self._cache.get(p.id)
            if cached is None or cached[0] != content_hash:
                to_encode_idx.append(i)
                to_encode_text.append(t)

        if to_encode_text:
            log.info(
                "EMBEDDING GENERATED - backend=%s items=%s/%s",
                backend.name,
                len(to_encode_text),
                len(products),
            )
            fresh = backend.encode(to_encode_text)
            fresh = normalize(to_float32(fresh))
            for slot, vec in zip(to_encode_idx, fresh):
                pid = products[slot].id
                self._cache[pid] = (_content_hash(texts[slot]), vec)
                self._evict_if_full()

        # Assemble the catalogue matrix in the same order as `products`.
        dim = next(iter(self._cache.values()))[1].shape[0]
        matrix = np.zeros((len(products), dim), dtype=np.float32)
        for i, p in enumerate(products):
            matrix[i] = self._cache[p.id][1]
        return matrix

    def _evict_if_full(self) -> None:
        max_size = self._settings.embedding_cache_size
        if len(self._cache) <= max_size:
            return
        # Drop the oldest insertion (dict preserves insertion order).
        for key in list(self._cache.keys())[: len(self._cache) - max_size]:
            self._cache.pop(key, None)


_embedding_singleton: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_singleton
    if _embedding_singleton is None:
        _embedding_singleton = EmbeddingService()
    return _embedding_singleton


def set_embedding_service(service: EmbeddingService) -> None:
    """Test hook for injecting a stub backend."""
    global _embedding_singleton
    _embedding_singleton = service
