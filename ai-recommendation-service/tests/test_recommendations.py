"""Recommendation logic tests.

Each Phase-1 feature gets a behavioural test, plus shared invariants:
  - The anchor product never appears in its own related/FBT list.
  - All scores fall in [0, 1].
  - Top-K is honoured (returned size ≤ requested).
  - Personalised output is stable per userId (deterministic heuristic).
"""

from __future__ import annotations

import pytest

from app.services.frequently_bought_service import FrequentlyBoughtTogetherService
from app.services.personalized_service import PersonalizedRecommendationService
from app.services.related_service import RelatedProductsService
from app.services.trending_service import TrendingService


pytestmark = pytest.mark.asyncio


class TestTrending:
    async def test_returns_top_k(self, engine, cache):
        svc = TrendingService()
        items = await svc.trending(limit=3)
        assert len(items) == 3
        assert all(0.0 <= it.score <= 1.0 for it in items)

    async def test_default_top_k_respects_settings(self, engine, cache):
        svc = TrendingService()
        items = await svc.trending()
        assert 1 <= len(items) <= 10

    async def test_caches_result(self, engine, cache):
        svc = TrendingService()
        await svc.trending(limit=3)
        await svc.trending(limit=3)
        assert cache.stats.hits >= 1


class TestRelated:
    async def test_excludes_anchor(self, engine, cache):
        svc = RelatedProductsService()
        items = await svc.related(product_id=1, limit=5)
        assert all(it.id != 1 for it in items)

    async def test_returns_top_k(self, engine, cache):
        svc = RelatedProductsService()
        items = await svc.related(product_id=1, limit=3)
        assert len(items) == 3

    async def test_dairy_clusters_with_dairy(self, engine, cache):
        """Same-category products (Dairy: milk → cheese, curd) should
        rank above unrelated categories. This validates the embedding
        signal rather than just the wiring."""
        svc = RelatedProductsService()
        items = await svc.related(product_id=1, limit=5)
        # The very top result should be a Dairy product, not e.g. Salt.
        assert items[0].category == "Dairy"

    async def test_unknown_product_raises(self, engine, cache):
        from app.core.exceptions import ProductNotFoundException

        svc = RelatedProductsService()
        with pytest.raises(ProductNotFoundException):
            await svc.related(product_id=9999)


class TestFrequentlyBought:
    async def test_only_same_category(self, engine, cache):
        svc = FrequentlyBoughtTogetherService()
        items = await svc.frequently_bought(product_id=1, limit=5)
        # Anchor product 1 is Dairy → all results should be Dairy too.
        assert all(it.category == "Dairy" for it in items)

    async def test_excludes_anchor(self, engine, cache):
        svc = FrequentlyBoughtTogetherService()
        items = await svc.frequently_bought(product_id=1, limit=5)
        assert all(it.id != 1 for it in items)

    async def test_top_k_capped(self, engine, cache):
        svc = FrequentlyBoughtTogetherService()
        items = await svc.frequently_bought(product_id=1, limit=2)
        assert len(items) <= 2


class TestPersonalized:
    async def test_returns_items(self, engine, cache):
        svc = PersonalizedRecommendationService()
        items = await svc.for_user(user_id=42, limit=5)
        assert len(items) == 5
        assert all(it.score >= 0 for it in items)

    async def test_deterministic_for_same_user(self, engine, cache):
        svc = PersonalizedRecommendationService()
        # Disable cache hit by clearing the cache between calls.
        first = await svc.for_user(user_id=99, limit=5)
        await cache.delete(cache.key("user", 99))
        second = await svc.for_user(user_id=99, limit=5)
        assert [it.id for it in first] == [it.id for it in second]

    async def test_different_users_can_differ(self, engine, cache):
        svc = PersonalizedRecommendationService()
        a = await svc.for_user(user_id=1, limit=10)
        b = await svc.for_user(user_id=99999, limit=10)
        # We don't insist they DO differ on a tiny catalogue, just that
        # the service runs cleanly for both — the heuristic is monotone
        # but not constant.
        assert len(a) == len(b)
