"""Redis cache tests.

Covers the cache-aside contract:

  - HIT       : cached value returned, compute() never called.
  - MISS      : compute() invoked once, value cached afterwards.
  - REDIS DOWN: compute() still returns a value (no exception bubbles).
  - INVALIDATE: deletes a key.

Uses fakeredis so tests don't need a live Redis container.
"""

from __future__ import annotations

import json

import pytest

from app.cache.redis_cache import RecommendationCache


pytestmark = pytest.mark.asyncio


class TestCacheAside:
    async def test_miss_invokes_compute_and_caches(self, cache: RecommendationCache):
        calls = {"n": 0}

        async def compute():
            calls["n"] += 1
            return {"hello": "world"}

        first = await cache.get_or_compute(
            key="reco:test:miss",
            ttl_seconds=60,
            compute=compute,
        )
        assert first == {"hello": "world"}
        assert calls["n"] == 1

        # Second call should hit and skip compute.
        second = await cache.get_or_compute(
            key="reco:test:miss",
            ttl_seconds=60,
            compute=compute,
        )
        assert second == {"hello": "world"}
        assert calls["n"] == 1
        assert cache.stats.hits == 1
        assert cache.stats.misses == 1

    async def test_invalidate_drops_key(self, cache: RecommendationCache):
        await cache.set("reco:test:drop", json.dumps({"a": 1}), ttl_seconds=60)
        removed = await cache.delete("reco:test:drop")
        assert removed == 1
        assert await cache.get("reco:test:drop") is None

    async def test_pattern_invalidation(self, cache: RecommendationCache):
        for i in range(5):
            await cache.set(f"reco:related:{i}", json.dumps([]), ttl_seconds=60)
        removed = await cache.invalidate_pattern("reco:related:*")
        assert removed == 5

    async def test_keys_are_namespaced(self, cache: RecommendationCache):
        # The default prefix is "reco" — `cache.key()` should produce it.
        assert cache.key("trending") == "reco:trending"
        assert cache.key("related", 42) == "reco:related:42"

    async def test_ttl_set_on_write(self, cache: RecommendationCache, fake_redis):
        await cache.set("reco:test:ttl", "value", ttl_seconds=120)
        ttl = await fake_redis.ttl("reco:test:ttl")
        assert 0 < ttl <= 120


class TestRedisDownFallback:
    async def test_compute_returns_when_redis_unreachable(self):
        """If the Redis client is None (couldn't connect), get_or_compute
        must STILL return the freshly-computed value — Redis is a cache,
        never a hard dependency.
        """
        broken = RecommendationCache(client=None)

        async def compute():
            return {"computed": True}

        result = await broken.get_or_compute(
            key="reco:test:down",
            ttl_seconds=60,
            compute=compute,
        )
        assert result == {"computed": True}

    async def test_corrupt_cache_value_recomputes(self, cache: RecommendationCache):
        """Garbage-in-cache must not poison responses — we recompute and
        log a CACHE ERROR rather than 5xx the request."""
        await cache.set("reco:test:bad", "{not-json", ttl_seconds=60)
        calls = {"n": 0}

        async def compute():
            calls["n"] += 1
            return [1, 2, 3]

        result = await cache.get_or_compute(
            key="reco:test:bad",
            ttl_seconds=60,
            compute=compute,
        )
        assert result == [1, 2, 3]
        assert calls["n"] == 1
