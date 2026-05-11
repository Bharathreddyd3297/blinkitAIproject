"""Per-user personalized recommendations — Phase-1 heuristic.

Phase-1 personalisation has no behavioural feed yet (no order-history
ingestion, no event stream). To still emit *something* useful per
userId we use a deterministic category-affinity heuristic:

    1. Hash the userId into a stable shuffled category preference list.
    2. Score each catalogue product = w_cat * affinity + w_recent * recency_norm.
    3. Return the top-K, with the product's category-rank surfaced as the score.

This is intentionally simple — it gives the frontend a stable,
non-degenerate response per user without pretending to be a real
recommender. The seam between heuristic and real model is the
`_score_for_user` method; swapping it for a learned model later
keeps every consumer untouched.

Cache key:
    reco:user:{userId}           (TTL 5 min)
"""

from __future__ import annotations

import hashlib
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


def _stable_category_preference(user_id: int, categories: List[str]) -> List[str]:
    """Deterministically rank categories by hashed (user_id, category)."""
    keyed = []
    for cat in categories:
        digest = hashlib.sha1(f"{user_id}:{cat}".encode("utf-8")).hexdigest()
        keyed.append((digest, cat))
    keyed.sort()
    return [cat for _, cat in keyed]


class PersonalizedRecommendationService:
    def __init__(
        self,
        engine: Optional[RecommendationEngine] = None,
        cache: Optional[RecommendationCache] = None,
    ) -> None:
        self._engine = engine or get_engine()
        self._cache = cache or get_cache()
        self._settings = get_settings()

    async def for_user(
        self,
        user_id: int,
        limit: Optional[int] = None,
        inbound_authorization: Optional[str] = None,
    ) -> List[RecommendationItem]:
        top_k = limit or self._settings.user_top_k
        cache_key = self._cache.key("user", user_id)

        async def compute() -> list[dict]:
            snap = await self._engine.get_snapshot(inbound_authorization)
            return self._score_for_user(user_id, snap.products, top_k)

        raw = await self._cache.get_or_compute(
            key=cache_key,
            ttl_seconds=self._settings.ttl_user_seconds,
            compute=compute,
        )
        return [RecommendationItem.model_validate(r) for r in raw]

    @staticmethod
    def _score_for_user(
        user_id: int,
        products: List[Product],
        top_k: int,
    ) -> list[dict]:
        if not products:
            return []

        unique_categories = sorted({p.category for p in products})
        preference_order = _stable_category_preference(user_id, unique_categories)
        rank_by_category = {cat: i for i, cat in enumerate(preference_order)}
        n_cats = len(preference_order) or 1

        # Category affinity: 1.0 for top, 0.0 for bottom.
        cat_aff = np.asarray(
            [1.0 - (rank_by_category[p.category] / n_cats) for p in products],
            dtype=np.float32,
        )

        stocks = np.asarray([p.stock for p in products], dtype=np.float32)
        max_stock = float(stocks.max()) if stocks.size and stocks.max() > 0 else 1.0
        stock_norm = stocks / max_stock

        scores = (0.75 * cat_aff + 0.25 * stock_norm).astype(np.float32)
        order = np.argsort(-scores)[:top_k]

        log.info(
            "PERSONALIZED COMPUTED - user=%s preferred=%s top_k=%s",
            user_id,
            preference_order[: min(3, len(preference_order))],
            top_k,
        )

        items: List[dict] = []
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
                    reason=f"Matches your preference for {p.category}",
                ).model_dump()
            )
        return items
