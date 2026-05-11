"""Shared fixtures.

The whole point of these fixtures is to keep tests offline:

  * `EMBEDDING_BACKEND=tfidf` forces the deterministic CPU-only backend
    (no torch download, no model load).
  * `fakeredis` stands in for the real Redis container.
  * `respx` mocks every product-service HTTP call.

Tests should never need network access — if a test you're writing does,
you're integrating something that should be mocked.
"""

from __future__ import annotations

import os

# Force the lightweight backend BEFORE any app module imports settings.
os.environ.setdefault("EMBEDDING_BACKEND", "tfidf")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("REDIS_HOST", "localhost")

from typing import AsyncIterator, Iterator, List  # noqa: E402

import fakeredis.aioredis  # noqa: E402
import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402

from app.cache.redis_cache import RecommendationCache, set_cache  # noqa: E402
from app.clients.product_client import ProductServiceClient, set_product_client  # noqa: E402
from app.services.embedding_service import EmbeddingService, set_embedding_service  # noqa: E402
from app.services.recommendation_engine import RecommendationEngine, set_engine  # noqa: E402
from tests.sample_data import (  # noqa: E402
    SAMPLE_PRODUCTS,
    sample_product_page_envelope,
    sample_product_response_envelope,
)


@pytest_asyncio.fixture
async def fake_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


@pytest_asyncio.fixture
async def cache(fake_redis) -> AsyncIterator[RecommendationCache]:
    c = RecommendationCache(client=fake_redis)
    set_cache(c)
    try:
        yield c
    finally:
        set_cache(RecommendationCache())  # restore a fresh, unconnected default


@pytest_asyncio.fixture
async def mocked_product_client(monkeypatch) -> AsyncIterator[ProductServiceClient]:
    """ProductServiceClient with a respx-mocked httpx transport.

    Routes mocked here cover GET /api/products?page&size and
    GET /api/products/{id}. The bound base_url + Authorization header
    propagation are exercised real-world via the actual httpx request
    pipeline.
    """
    import respx

    base_url = "http://product-service:8082"
    transport = httpx.AsyncClient(base_url=base_url, timeout=5.0)

    router = respx.MockRouter(assert_all_called=False, base_url=base_url)
    router.start()

    @router.get("/api/products")
    def _list(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=sample_product_page_envelope(SAMPLE_PRODUCTS))

    @router.get(httpx.URL("/api/products"))
    def _list2(request: httpx.Request) -> httpx.Response:  # pragma: no cover
        return httpx.Response(200, json=sample_product_page_envelope(SAMPLE_PRODUCTS))

    @router.get("/actuator/health")
    def _actuator_health(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "UP"})

    @router.get(url__regex=r"/api/products/(?P<pid>\d+)")
    def _by_id(request: httpx.Request, pid: str) -> httpx.Response:
        product_id = int(pid)
        for p in SAMPLE_PRODUCTS:
            if p.id == product_id:
                return httpx.Response(200, json=sample_product_response_envelope(p))
        return httpx.Response(
            404,
            json={
                "success": False,
                "message": f"Product {product_id} not found",
                "error": "PRODUCT_NOT_FOUND",
                "status": 404,
            },
        )

    client = ProductServiceClient(client=transport)
    set_product_client(client)
    try:
        yield client
    finally:
        await transport.aclose()
        router.stop()
        router.reset()
        set_product_client(ProductServiceClient())


@pytest_asyncio.fixture
async def engine(mocked_product_client, cache) -> AsyncIterator[RecommendationEngine]:
    embedding = EmbeddingService()
    set_embedding_service(embedding)
    eng = RecommendationEngine(product_client=mocked_product_client, embedding_service=embedding)
    set_engine(eng)
    try:
        yield eng
    finally:
        set_engine(RecommendationEngine())
        set_embedding_service(EmbeddingService())


@pytest.fixture
def sample_products() -> List:
    return list(SAMPLE_PRODUCTS)
