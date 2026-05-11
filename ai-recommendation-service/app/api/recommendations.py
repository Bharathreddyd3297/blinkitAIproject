"""Public recommendation endpoints.

All four Phase-1 features expose the same envelope shape so the
frontend can render them with one component. The Authorization header
(if present on the inbound request) is captured here and forwarded to
product-service downstream — that is the *only* place this service
touches the inbound auth header.
"""

from __future__ import annotations

import time
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, Path, Query, Request

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.api_response import ApiResponse
from app.schemas.recommendation import RecommendationItem
from app.services.frequently_bought_service import FrequentlyBoughtTogetherService
from app.services.personalized_service import PersonalizedRecommendationService
from app.services.related_service import RelatedProductsService
from app.services.trending_service import TrendingService

log = get_logger(__name__)
router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


# ---------------------------------------------------------------------------- #
# DI providers
# ---------------------------------------------------------------------------- #

def _trending() -> TrendingService:
    return TrendingService()


def _related() -> RelatedProductsService:
    return RelatedProductsService()


def _fbt() -> FrequentlyBoughtTogetherService:
    return FrequentlyBoughtTogetherService()


def _personalized() -> PersonalizedRecommendationService:
    return PersonalizedRecommendationService()


# ---------------------------------------------------------------------------- #
# Endpoints
# ---------------------------------------------------------------------------- #

@router.get("/trending", response_model=ApiResponse[List[RecommendationItem]])
async def trending(
    request: Request,
    limit: Optional[int] = Query(default=None, ge=1, le=50),
    authorization: Optional[str] = Header(default=None),
    service: TrendingService = Depends(_trending),
) -> ApiResponse[List[RecommendationItem]]:
    started = time.perf_counter()
    items = await service.trending(limit=limit, inbound_authorization=authorization)
    _log_timing("trending", started, request, len(items))
    return ApiResponse.ok(data=items, message="Trending products fetched successfully")


@router.get("/related/{product_id}", response_model=ApiResponse[List[RecommendationItem]])
async def related(
    request: Request,
    product_id: int = Path(..., ge=1),
    limit: Optional[int] = Query(default=None, ge=1, le=20),
    authorization: Optional[str] = Header(default=None),
    service: RelatedProductsService = Depends(_related),
) -> ApiResponse[List[RecommendationItem]]:
    started = time.perf_counter()
    items = await service.related(
        product_id=product_id,
        limit=limit,
        inbound_authorization=authorization,
    )
    _log_timing(f"related:{product_id}", started, request, len(items))
    return ApiResponse.ok(
        data=items,
        message="Related products fetched successfully",
    )


@router.get(
    "/frequently-bought/{product_id}",
    response_model=ApiResponse[List[RecommendationItem]],
)
async def frequently_bought(
    request: Request,
    product_id: int = Path(..., ge=1),
    limit: Optional[int] = Query(default=None, ge=1, le=20),
    authorization: Optional[str] = Header(default=None),
    service: FrequentlyBoughtTogetherService = Depends(_fbt),
) -> ApiResponse[List[RecommendationItem]]:
    started = time.perf_counter()
    items = await service.frequently_bought(
        product_id=product_id,
        limit=limit,
        inbound_authorization=authorization,
    )
    _log_timing(f"fbt:{product_id}", started, request, len(items))
    return ApiResponse.ok(
        data=items,
        message="Frequently bought together fetched successfully",
    )


@router.get("/user/{user_id}", response_model=ApiResponse[List[RecommendationItem]])
async def user_recommendations(
    request: Request,
    user_id: int = Path(..., ge=1),
    limit: Optional[int] = Query(default=None, ge=1, le=50),
    authorization: Optional[str] = Header(default=None),
    service: PersonalizedRecommendationService = Depends(_personalized),
) -> ApiResponse[List[RecommendationItem]]:
    started = time.perf_counter()
    items = await service.for_user(
        user_id=user_id,
        limit=limit,
        inbound_authorization=authorization,
    )
    _log_timing(f"user:{user_id}", started, request, len(items))
    return ApiResponse.ok(
        data=items,
        message="Personalized recommendations fetched successfully",
    )


# ---------------------------------------------------------------------------- #
# Diagnostics — internal only, no auth (matches Phase-1 "internal layer")
# ---------------------------------------------------------------------------- #

@router.get("/_diag/cache-stats")
async def cache_stats() -> ApiResponse[dict]:
    """Lightweight introspection of the cache hit/miss/error counters."""
    from app.cache.redis_cache import get_cache

    settings = get_settings()
    cache = get_cache()
    s = cache.stats
    return ApiResponse.ok(
        data={
            "hits": s.hits,
            "misses": s.misses,
            "errors": s.errors,
            "prefix": settings.redis_key_prefix,
        },
        message="Cache stats",
    )


def _log_timing(label: str, started: float, request: Request, count: int) -> None:
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    log.info(
        "RECOMMENDATION SERVED - endpoint=%s items=%s elapsed_ms=%.1f path=%s",
        label,
        count,
        elapsed_ms,
        request.url.path,
    )
