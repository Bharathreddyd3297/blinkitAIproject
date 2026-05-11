"""Redis cache-aside layer for recommendations.

Single touch-point for Redis in this service — every recommendation
service calls `get_or_compute` and never speaks to redis-py directly.
That keeps the rollback story simple if we ever swap Redis for an
alternate cache (e.g. Azure Cache for Redis Premium with cluster mode):
the change lands here and nowhere else.

Failure model
-------------
- Redis up, key hit:  return cached payload, log CACHE HIT.
- Redis up, key miss: invoke `compute()`, write back, return fresh.
- Redis down/timeout: log CACHE ERROR, fall through to `compute()`.

A cache miss must NEVER turn into a 5xx — that rule is enforced here
and verified by the Redis-down fallback test in tests/test_cache.py.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional, TypeVar

import redis.asyncio as redis_async
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.logging import get_logger

T = TypeVar("T")

log = get_logger(__name__)


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    errors: int = 0


class RecommendationCache:
    """Cache-aside wrapper around redis-py async.

    Keys are prefixed with `<settings.redis_key_prefix>:` and values are
    JSON strings so the cache stays language-agnostic — anything that
    speaks Redis can read it. (We don't share keys across services per
    REDIS_INTEGRATION_PLAN.md hard-rule #1, but JSON keeps the door
    open for ops tooling.)
    """

    def __init__(self, client: Optional[redis_async.Redis] = None):
        self._settings = get_settings()
        self._client: Optional[redis_async.Redis] = client
        self._stats = CacheStats()

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #

    async def connect(self) -> None:
        if self._client is not None:
            return
        self._client = redis_async.Redis(
            host=self._settings.redis_host,
            port=self._settings.redis_port,
            db=self._settings.redis_db,
            password=self._settings.redis_password,
            socket_timeout=self._settings.redis_socket_timeout_seconds,
            socket_connect_timeout=self._settings.redis_socket_timeout_seconds,
            decode_responses=True,
            health_check_interval=30,
        )
        try:
            await self._client.ping()
            log.info("Redis connected host=%s port=%s", self._settings.redis_host, self._settings.redis_port)
        except RedisError as exc:
            log.warning(
                "CACHE ERROR on connect, service will run in cache-bypass mode reason=%s",
                exc,
            )

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:  # pragma: no cover - close is best-effort
                pass
            self._client = None

    # ------------------------------------------------------------------ #
    # Key helpers
    # ------------------------------------------------------------------ #

    def key(self, *parts: str | int) -> str:
        return ":".join([self._settings.redis_key_prefix, *map(str, parts)])

    @property
    def stats(self) -> CacheStats:
        return self._stats

    # ------------------------------------------------------------------ #
    # Read / write
    # ------------------------------------------------------------------ #

    async def get(self, key: str) -> Optional[str]:
        if self._client is None:
            return None
        try:
            value = await self._client.get(key)
            if value is not None:
                self._stats.hits += 1
                log.info("CACHE HIT - key=%s", key)
                return value
            self._stats.misses += 1
            log.info("CACHE MISS - key=%s", key)
            return None
        except RedisError as exc:
            self._stats.errors += 1
            log.warning("CACHE ERROR on read, falling back to compute key=%s reason=%s", key, exc)
            return None

    async def set(self, key: str, value: str, ttl_seconds: int) -> None:
        if self._client is None:
            return
        try:
            await self._client.set(key, value, ex=ttl_seconds)
            log.debug("CACHE WRITE - key=%s ttl=%ss", key, ttl_seconds)
        except RedisError as exc:
            self._stats.errors += 1
            log.warning("CACHE ERROR on write, skipping key=%s reason=%s", key, exc)

    async def delete(self, *keys: str) -> int:
        if self._client is None or not keys:
            return 0
        try:
            removed = await self._client.delete(*keys)
            log.info("CACHE INVALIDATED - keys=%s removed=%s", list(keys), removed)
            return int(removed)
        except RedisError as exc:
            self._stats.errors += 1
            log.warning("CACHE ERROR on delete, ignoring reason=%s", exc)
            return 0

    async def invalidate_pattern(self, pattern: str) -> int:
        """SCAN + UNLINK by glob pattern. Used for bulk eviction."""
        if self._client is None:
            return 0
        removed = 0
        try:
            async for k in self._client.scan_iter(match=pattern, count=200):
                await self._client.unlink(k)
                removed += 1
            log.info("CACHE INVALIDATED - pattern=%s matched=%s", pattern, removed)
        except RedisError as exc:
            self._stats.errors += 1
            log.warning("CACHE ERROR on pattern delete, ignoring pattern=%s reason=%s", pattern, exc)
        return removed

    # ------------------------------------------------------------------ #
    # Cache-aside helper (the hot path)
    # ------------------------------------------------------------------ #

    async def get_or_compute(
        self,
        key: str,
        ttl_seconds: int,
        compute: Callable[[], Awaitable[T]],
        serializer: Callable[[T], str] = lambda v: json.dumps(v, default=str),
        deserializer: Callable[[str], T] = json.loads,
    ) -> T:
        """Cache-aside: hit → return; miss/error → compute, write, return.

        `compute` MUST always succeed independently of Redis state — it is
        the source of truth. If Redis is down, we still return the freshly
        computed value; we just don't get to write it back.
        """
        cached = await self.get(key)
        if cached is not None:
            try:
                return deserializer(cached)
            except (ValueError, TypeError) as exc:
                log.warning("CACHE ERROR on deserialize, recomputing key=%s reason=%s", key, exc)

        started = time.perf_counter()
        value = await compute()
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        log.info("RECOMMENDATION COMPUTED - key=%s elapsed_ms=%.1f", key, elapsed_ms)

        try:
            await self.set(key, serializer(value), ttl_seconds)
        except (TypeError, ValueError) as exc:
            log.warning("CACHE ERROR on serialize, returning value key=%s reason=%s", key, exc)
        return value


_cache_singleton: Optional[RecommendationCache] = None


def get_cache() -> RecommendationCache:
    global _cache_singleton
    if _cache_singleton is None:
        _cache_singleton = RecommendationCache()
    return _cache_singleton


def set_cache(cache: RecommendationCache) -> None:
    """Test hook. Lets pytest swap in a fakeredis-backed instance."""
    global _cache_singleton
    _cache_singleton = cache
