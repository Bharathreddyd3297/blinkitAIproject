"""Related products via embedding cosine similarity.

For an anchor product, return the K most semantically-similar products
in the catalogue. Similarity is computed over the L2-normalised
embedding matrix from the engine — a single matrix-vector multiply,
O(N) in the catalogue size.

Why embeddings, not co-purchase?
    Phase-1 has no order-history signal yet. Embeddings on
    `name + category + description` give a strong content-based
    signal that doesn't require behavioural data. Once order
    history is wired in we'll blend the two scores; that work
    is scoped in the README roadmap.

Cache key:
    reco:related:{productId}     (TTL 1 hour)
"""

from __future__ import annotations

from typing import List, Optional

from app.cache.redis_cache import RecommendationCache, get_cache
from app.core.config import get_settings
from app.core.exceptions import ProductNotFoundException
from app.core.logging import get_logger
from app.models.product import Product
from app.schemas.recommendation import RecommendationItem
from app.services.recommendation_engine import RecommendationEngine, get_engine
from app.utils.similarity import clip_score, top_k_indices

log = get_logger(__name__)


class RelatedProductsService:
    def __init__(
        self,
        engine: Optional[RecommendationEngine] = None,
        cache: Optional[RecommendationCache] = None,
    ) -> None:
        self._engine = engine or get_engine()
        self._cache = cache or get_cache()
        self._settings = get_settings()

    async def related(
        self,
        product_id: int,
        limit: Optional[int] = None,
        inbound_authorization: Optional[str] = None,
    ) -> List[RecommendationItem]:
        top_k = limit or self._settings.related_top_k
        cache_key = self._cache.key("related", product_id)

        async def compute() -> list[dict]:
            snap = await self._engine.get_snapshot(inbound_authorization)
            anchor_idx = snap.index_of(product_id)
            if anchor_idx is None:
                raise ProductNotFoundException(
                    f"Product {product_id} not in current catalogue snapshot"
                )

            anchor_vec = snap.embeddings[anchor_idx]
            scores = snap.embeddings @ anchor_vec
            log.info(
                "SIMILARITY COMPUTED - source=%s catalog=%s topK=%s",
                product_id,
                len(snap.products),
                top_k,
            )

            picks = top_k_indices(scores, top_k, exclude=[anchor_idx])
            anchor: Product = snap.products[anchor_idx]
            return [
                _to_item(snap.products[idx], score, anchor).model_dump()
                for idx, score in picks
            ]

        raw = await self._cache.get_or_compute(
            key=cache_key,
            ttl_seconds=self._settings.ttl_related_seconds,
            compute=compute,
        )
        return [RecommendationItem.model_validate(r) for r in raw]


def _to_item(product: Product, score: float, anchor: Product) -> RecommendationItem:
    return RecommendationItem(
        id=product.id,
        name=product.name,
        category=product.category,
        price=float(product.price),
        image_url=product.image_url,
        score=clip_score(score),
        reason=f"Semantically similar to '{anchor.name}'",
    )
