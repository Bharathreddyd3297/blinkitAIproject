"""Health endpoints.

Mirrors the JVM platform's /actuator/health surface so future Kubernetes
liveness/readiness probes can ship with no manifest churn.
"""

from __future__ import annotations

from typing import Optional

import httpx
from fastapi import APIRouter, Response
from redis.exceptions import RedisError

from app.cache.redis_cache import get_cache
from app.clients.product_client import get_product_client
from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)
router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """Aggregate health: service is UP if itself is reachable.

    Sub-component status (`redis`, `productService`) is reported but does
    NOT downgrade the overall status — by design, this service stays UP
    when Redis is down (cache-aside falls through). Same is true for
    product-service from the *liveness* perspective; readiness can be
    tightened later.
    """
    settings = get_settings()
    redis_status = await _check_redis()
    product_status = await _check_product_service()
    return {
        "status": "UP",
        "service": settings.service_name,
        "version": _service_version(),
        "components": {
            "redis": redis_status,
            "productService": product_status,
        },
    }


@router.get("/health/liveness")
async def liveness() -> dict:
    return {"status": "UP"}


@router.get("/health/readiness", responses={503: {"description": "Not ready"}})
async def readiness(response: Response) -> dict:
    """Ready iff Redis is reachable AND product-service responded recently.

    Redis-down doesn't fail liveness (the service still serves requests),
    but readiness gates traffic so a freshly-rolled pod that can't reach
    Redis won't immediately get pummelled while degraded.
    """
    redis_status = await _check_redis()
    product_status = await _check_product_service()
    overall_up = redis_status.get("status") == "UP" and product_status.get("status") == "UP"
    if not overall_up:
        response.status_code = 503
    return {
        "status": "UP" if overall_up else "DOWN",
        "components": {
            "redis": redis_status,
            "productService": product_status,
        },
    }


async def _check_redis() -> dict:
    cache = get_cache()
    if cache._client is None:  # type: ignore[attr-defined]  # internal probe
        return {"status": "DOWN", "reason": "not connected"}
    try:
        await cache._client.ping()  # type: ignore[attr-defined]
        return {"status": "UP"}
    except RedisError as exc:
        return {"status": "DOWN", "reason": str(exc)}


async def _check_product_service() -> dict:
    settings = get_settings()
    timeout = httpx.Timeout(2.0, connect=2.0)
    url = settings.product_service_base_url.rstrip("/") + "/actuator/health"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url)
            return {"status": "UP" if resp.status_code < 500 else "DOWN", "code": resp.status_code}
    except httpx.RequestError as exc:
        return {"status": "DOWN", "reason": str(exc)}


def _service_version() -> Optional[str]:
    try:
        from app import __version__

        return __version__
    except Exception:  # pragma: no cover
        return None
