"""End-to-end FastAPI tests.

Spins up the actual ASGI app with mocked Redis + product-service and
exercises every Phase-1 endpoint through httpx.AsyncClient. Verifies:

  - HTTP status codes (200, 404, 422).
  - The platform-wide ApiResponse<T> envelope shape.
  - That each endpoint returns RecommendationItem-shaped data.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def client(engine, cache):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestEnvelope:
    async def test_trending_envelope(self, client):
        resp = await client.get("/api/recommendations/trending?limit=3")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["message"]
        assert "timestamp" in body
        assert isinstance(body["data"], list)
        assert len(body["data"]) == 3
        item = body["data"][0]
        for field in ("id", "name", "category", "score"):
            assert field in item

    async def test_related_envelope(self, client):
        resp = await client.get("/api/recommendations/related/1?limit=5")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert all(it["id"] != 1 for it in body["data"])

    async def test_frequently_bought_envelope(self, client):
        resp = await client.get("/api/recommendations/frequently-bought/1?limit=3")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert all(it["category"] == "Dairy" for it in body["data"])

    async def test_user_envelope(self, client):
        resp = await client.get("/api/recommendations/user/42?limit=4")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 4


class TestErrors:
    async def test_unknown_product_returns_404_envelope(self, client):
        resp = await client.get("/api/recommendations/related/9999")
        assert resp.status_code == 404
        body = resp.json()
        assert body["success"] is False
        assert body["error"] == "PRODUCT_NOT_FOUND"
        assert body["status"] == 404

    async def test_invalid_path_param_returns_422(self, client):
        resp = await client.get("/api/recommendations/related/-1")
        # FastAPI ge=1 → 422 with our VALIDATION_ERROR envelope.
        assert resp.status_code == 422
        body = resp.json()
        assert body["success"] is False
        assert body["error"] == "VALIDATION_ERROR"


class TestHealth:
    async def test_liveness_is_up(self, client):
        resp = await client.get("/health/liveness")
        assert resp.status_code == 200
        assert resp.json()["status"] == "UP"

    async def test_health_aggregate(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "UP"
        assert "components" in body
