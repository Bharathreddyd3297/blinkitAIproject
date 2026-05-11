"""Frequently bought together — Phase-1 heuristic.

Without order history we cannot mine real co-purchase pairs. The
Phase-1 stand-in: products in the *same category* as the anchor,
ranked by a blend of:

    score = 0.7 * embedding_similarity + 0.3 * stock_normalisation

The category filter keeps the recommendation grocery-realistic
(milk does not get suggested with shampoo) and the embedding
component prefers items that pair semantically with the anchor.

Phase-2 plan (documented for the next contributor): replace this
heuristic with co-occurrence mining over `blinkit_orders`. The
public API is stable across that swap — only the internals of
`compute()` change.

Cache key:
    reco:fbt:{productId}        (TTL 1 hour)
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np

from app.cache.redis_cache import RecommendationCache, get_cache
from app.core.config import get_settings
from app.core.exceptions import ProductNotFoundException
from app.core.logging import get_logger
from app.models.product import Product
from app.schemas.recommendation import RecommendationItem
from app.services.recommendation_engine import RecommendationEngine, get_engine
from app.utils.similarity import clip_score

log = get_logger(__name__)


class FrequentlyBoughtTogetherService:
    def __init__(
        self,
        engine: Optional[RecommendationEngine] = None,
        cache: Optional[RecommendationCache] = None,
    ) -> None:
        self._engine = engine or get_engine()
        self._cache = cache or get_cache()
        self._settings = get_settings()

    async def frequently_bought(
        self,
        product_id: int,
        limit: Optional[int] = None,
        inbound_authorization: Optional[str] = None,
    ) -> List[RecommendationItem]:
        top_k = limit or self._settings.frequently_bought_top_k
        cache_key = self._cache.key("fbt", product_id)

        async def compute() -> list[dict]:
            snap = await self._engine.get_snapshot(inbound_authorization)
            anchor_idx = snap.index_of(product_id)
            if anchor_idx is None:
                raise ProductNotFoundException(
                    f"Product {product_id} not in current catalogue snapshot"
                )

            anchor: Product = snap.products[anchor_idx]
            anchor_vec = snap.embeddings[anchor_idx]
            sims = snap.embeddings @ anchor_vec

            stocks = np.asarray([p.stock for p in snap.products], dtype=np.float32)
            max_stock = float(stocks.max()) if stocks.size and stocks.max() > 0 else 1.0
            stock_norm = stocks / max_stock

            blended = 0.7 * sims + 0.3 * stock_norm
            log.info(
                "FBT COMPUTED - anchor=%s category=%s topK=%s",
                product_id,
                anchor.category,
                top_k,
            )

            same_cat = [
                i
                for i, p in enumerate(snap.products)
                if p.category == anchor.category and i != anchor_idx
            ]
            same_cat.sort(key=lambda i: float(blended[i]), reverse=True)
            picks = same_cat[:top_k]

            return [
                RecommendationItem(
                    id=snap.products[i].id,
                    name=snap.products[i].name,
                    category=snap.products[i].category,
                    price=float(snap.products[i].price),
                    image_url=snap.products[i].image_url,
                    score=clip_score(blended[i]),
                    reason=f"Often bought with '{anchor.name}'",
                ).model_dump()
                for i in picks
            ]

        raw = await self._cache.get_or_compute(
            key=cache_key,
            ttl_seconds=self._settings.ttl_frequently_bought_seconds,
            compute=compute,
        )
        return [RecommendationItem.model_validate(r) for r in raw]
