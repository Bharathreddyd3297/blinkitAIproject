"""Trending products.

Phase-1 ranking heuristic (no order history yet):

  trending_score = 0.6 * recency_norm + 0.4 * stock_norm

  - recency_norm: newest products score higher (proxy for "freshly
    added", a strong popularity signal in q-commerce).
  - stock_norm:   high-stock items score higher (proxy for active
    replenishment — operations stocks more of what sells).

When `created_at` is missing for everything we collapse to pure
stock-based ranking, which still gives a sensible default. The exact
formula is documented here so the ML team can swap it for a learned
ranker without changing the API contract.

Cache key:
    reco:trending          (TTL 5 min)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

import numpy as np

from app.cache.redis_cache import RecommendationCache, get_cache
from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.product import Product
from app.schemas.recommendation import RecommendationItem
from app.services.recommendation_engine import RecommendationEngine, get_engine
from app.utils.similarity import clip_score

log = get_logger(__name__)


def _epoch_seconds(value: Optional[datetime]) -> float:
    if value is None:
        return 0.0
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.timestamp()


class TrendingService:
    def __init__(
        self,
        engine: Optional[RecommendationEngine] = None,
        cache: Optional[RecommendationCache] = None,
    ) -> None:
        self._engine = engine or get_engine()
        self._cache = cache or get_cache()
        self._settings = get_settings()

    async def trending(
        self,
        limit: Optional[int] = None,
        inbound_authorization: Optional[str] = None,
    ) -> List[RecommendationItem]:
        top_k = limit or self._settings.trending_top_k
        cache_key = self._cache.key("trending")

        async def compute() -> list[dict]:
            snap = await self._engine.get_snapshot(inbound_authorization)
            ranked = self._rank(snap.products, top_k)
            return [item.model_dump() for item in ranked]

        raw = await self._cache.get_or_compute(
            key=cache_key,
            ttl_seconds=self._settings.ttl_trending_seconds,
            compute=compute,
        )
        return [RecommendationItem.model_validate(r) for r in raw]

    @staticmethod
    def _rank(products: List[Product], top_k: int) -> List[RecommendationItem]:
        if not products:
            return []

        stocks = np.asarray([p.stock for p in products], dtype=np.float32)
        max_stock = float(stocks.max()) if stocks.size and stocks.max() > 0 else 1.0
        stock_norm = stocks / max_stock

        epoch = np.asarray(
            [_epoch_seconds(p.created_at) for p in products],
            dtype=np.float64,
        )
        if epoch.max() > epoch.min():
            recency_norm = (epoch - epoch.min()) / (epoch.max() - epoch.min())
        else:
            recency_norm = np.zeros_like(epoch, dtype=np.float64)

        scores = (0.6 * recency_norm + 0.4 * stock_norm).astype(np.float32)
        order = np.argsort(-scores)[:top_k]

        items: List[RecommendationItem] = []
        for idx in order:
            p = products[int(idx)]
            items.append(
                RecommendationItem(
                    id=p.id,
                    name=p.name,
                    category=p.category,
                    price=float(p.price),
                    image_url=p.image_url,
                    score=clip_score(scores[int(idx)]),
                    reason="High stock and recently listed",
                )
            )
        log.info("TRENDING RANKED - returned=%s of=%s", len(items), len(products))
        return items
