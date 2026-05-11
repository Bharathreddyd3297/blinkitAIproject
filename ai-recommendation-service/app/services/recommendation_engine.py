"""Catalogue snapshot + embedding matrix shared by all four features.

Each recommendation feature (trending, related, frequently-bought, user)
needs the same two pieces of state:

  1. The current product catalogue (list of `Product`).
  2. The L2-normalised embedding matrix aligned with that list.

Recomputing both per request would burn the embedding model for nothing,
so the engine maintains a process-local snapshot with a short TTL. The
snapshot is rebuilt under a single asyncio.Lock to prevent thundering-herd
re-fetches during catalogue churn.

The snapshot is intentionally NOT cached in Redis — Redis caches the
*recommendation outputs* (per the spec), not the embedding matrix.
Rebuilding the snapshot in a fresh container is fast enough (< few seconds
for a small catalogue) and avoids cross-process serialisation of numpy.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np

from app.clients.product_client import ProductServiceClient, get_product_client
from app.core.config import get_settings
from app.core.exceptions import CatalogEmptyException
from app.core.logging import get_logger
from app.models.product import Product
from app.services.embedding_service import EmbeddingService, get_embedding_service

log = get_logger(__name__)


@dataclass
class CatalogSnapshot:
    products: List[Product]
    embeddings: np.ndarray
    id_index: Dict[int, int]
    fetched_at: float

    def is_fresh(self, ttl_seconds: int) -> bool:
        return (time.time() - self.fetched_at) < ttl_seconds

    def index_of(self, product_id: int) -> Optional[int]:
        return self.id_index.get(product_id)


class RecommendationEngine:
    def __init__(
        self,
        product_client: Optional[ProductServiceClient] = None,
        embedding_service: Optional[EmbeddingService] = None,
    ) -> None:
        self._settings = get_settings()
        self._product_client = product_client or get_product_client()
        self._embeddings = embedding_service or get_embedding_service()
        self._snapshot: Optional[CatalogSnapshot] = None
        self._refresh_lock = asyncio.Lock()

    @property
    def snapshot(self) -> Optional[CatalogSnapshot]:
        return self._snapshot

    async def get_snapshot(
        self,
        inbound_authorization: Optional[str] = None,
        force_refresh: bool = False,
    ) -> CatalogSnapshot:
        """Return a fresh-enough catalogue snapshot, refreshing under lock."""
        snap = self._snapshot
        if (
            not force_refresh
            and snap is not None
            and snap.is_fresh(self._settings.ttl_catalog_snapshot_seconds)
        ):
            return snap

        async with self._refresh_lock:
            # Re-check after acquiring the lock — another caller may have refreshed.
            snap = self._snapshot
            if (
                not force_refresh
                and snap is not None
                and snap.is_fresh(self._settings.ttl_catalog_snapshot_seconds)
            ):
                return snap

            log.info("CATALOG SNAPSHOT - refreshing")
            products = await self._product_client.list_products(inbound_authorization)
            if not products:
                raise CatalogEmptyException("Product catalogue is empty")

            embeddings = await self._embeddings.encode_catalog(products)
            id_index = {p.id: i for i, p in enumerate(products)}
            self._snapshot = CatalogSnapshot(
                products=products,
                embeddings=embeddings,
                id_index=id_index,
                fetched_at=time.time(),
            )
            log.info(
                "CATALOG SNAPSHOT - ready products=%s dim=%s backend=%s",
                len(products),
                embeddings.shape[1] if embeddings.size else 0,
                self._embeddings.backend_name,
            )
            return self._snapshot

    def invalidate(self) -> None:
        """Force the next caller to refetch. Public hook for future
        event-driven refresh (REDIS_INTEGRATION_PLAN.md §10)."""
        self._snapshot = None


_engine_singleton: Optional[RecommendationEngine] = None


def get_engine() -> RecommendationEngine:
    global _engine_singleton
    if _engine_singleton is None:
        _engine_singleton = RecommendationEngine()
    return _engine_singleton


def set_engine(engine: RecommendationEngine) -> None:
    """Test hook."""
    global _engine_singleton
    _engine_singleton = engine
