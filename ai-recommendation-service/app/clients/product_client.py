"""HTTP client for product-service.

Mirrors the JVM `XServiceClient` template documented in AI_ASSISTANT_GUIDE.md §8:

  - One client class per upstream service.
  - Explicit base URL + timeouts (httpx Limits).
  - Forwards the inbound `Authorization` header on every call (platform's
    "single end-user identity flows through every hop" trust model).
  - Deserialises responses as `ApiResponse<T>` first, then unwraps `.data` —
    deserialising the inner DTO directly produces silently-null fields.
  - HTTP failures translate into typed domain exceptions; the API layer
    maps those into envelope errors via the global handler.
"""

from __future__ import annotations

from typing import List, Optional

import httpx

from app.core.config import get_settings
from app.core.exceptions import (
    ProductNotFoundException,
    ProductServiceException,
)
from app.core.logging import get_logger
from app.models.product import Product

log = get_logger(__name__)


class ProductServiceClient:
    """Async HTTP client over the product-service catalogue API."""

    def __init__(self, client: Optional[httpx.AsyncClient] = None) -> None:
        self._settings = get_settings()
        self._client: Optional[httpx.AsyncClient] = client

    async def connect(self) -> None:
        if self._client is not None:
            return
        timeout = httpx.Timeout(
            self._settings.product_service_timeout_seconds,
            connect=self._settings.product_service_timeout_seconds,
        )
        self._client = httpx.AsyncClient(
            base_url=self._settings.product_service_base_url,
            timeout=timeout,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            headers={"Accept": "application/json"},
        )
        log.info("ProductServiceClient ready base_url=%s", self._settings.product_service_base_url)

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------ #
    # Authorization-header propagation
    # ------------------------------------------------------------------ #

    def _auth_headers(self, inbound_authorization: Optional[str]) -> dict[str, str]:
        """Forward inbound bearer if present, else fall back to internal JWT.

        product-service requires bearer auth on every read endpoint. When
        invoked through the API Gateway with an end-user JWT we forward
        that token verbatim. When the AI service is invoked directly
        without a header (warm-up, dev) we fall back to
        INTERNAL_SERVICE_JWT, which is intentionally optional — leave it
        unset if the caller is always providing one.
        """
        token = inbound_authorization or (
            f"Bearer {self._settings.internal_service_jwt}"
            if self._settings.internal_service_jwt
            else None
        )
        return {"Authorization": token} if token else {}

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def get_product(
        self,
        product_id: int,
        inbound_authorization: Optional[str] = None,
    ) -> Product:
        """GET /api/products/{id} → Product. 404 → ProductNotFoundException."""
        if self._client is None:
            await self.connect()
        assert self._client is not None

        try:
            resp = await self._client.get(
                f"/api/products/{product_id}",
                headers=self._auth_headers(inbound_authorization),
            )
        except httpx.RequestError as exc:
            raise ProductServiceException(
                f"Unable to reach product-service: {exc}",
            ) from exc

        if resp.status_code == 404:
            raise ProductNotFoundException(f"Product {product_id} not found")
        if resp.status_code >= 500:
            raise ProductServiceException(
                f"product-service returned {resp.status_code} for id={product_id}"
            )
        if resp.status_code >= 400:
            raise ProductServiceException(
                f"product-service rejected request status={resp.status_code} id={product_id}"
            )

        return self._unwrap_single(resp.json())

    async def list_products(
        self,
        inbound_authorization: Optional[str] = None,
    ) -> List[Product]:
        """Page through GET /api/products and flatten into a single list.

        Used by the recommendation engine to (re)build the catalogue
        snapshot. Pagination is bounded by `product_service_max_pages`
        so a runaway catalogue can't OOM the embedding pass.
        """
        if self._client is None:
            await self.connect()
        assert self._client is not None

        out: List[Product] = []
        page_size = self._settings.product_service_page_size
        for page in range(self._settings.product_service_max_pages):
            try:
                resp = await self._client.get(
                    "/api/products",
                    params={"page": page, "size": page_size},
                    headers=self._auth_headers(inbound_authorization),
                )
            except httpx.RequestError as exc:
                raise ProductServiceException(
                    f"Unable to reach product-service: {exc}"
                ) from exc

            if resp.status_code >= 400:
                raise ProductServiceException(
                    f"product-service list failed status={resp.status_code}"
                )

            page_products, has_more = self._unwrap_page(resp.json())
            out.extend(page_products)
            if not has_more or len(page_products) < page_size:
                break

        log.info("CATALOG SNAPSHOT - fetched=%s pages=%s", len(out), page + 1)
        return out

    # ------------------------------------------------------------------ #
    # ApiResponse<T> envelope unwrapping
    # ------------------------------------------------------------------ #

    @staticmethod
    def _unwrap_single(payload: dict) -> Product:
        if not payload.get("success", False):
            raise ProductServiceException(
                payload.get("message", "product-service returned success=false")
            )
        data = payload.get("data") or {}
        return Product.model_validate(data)

    @staticmethod
    def _unwrap_page(payload: dict) -> tuple[list[Product], bool]:
        """Handle both Spring `Page<T>` and the platform's PageResponse shape.

        product-service returns ApiResponse<PageResponse<ProductResponse>>:
            { success, data: { content:[…], totalPages, last, … }, … }
        We tolerate the alternate {data:[…]} shape too so this client
        keeps working if a future endpoint returns a flat list.
        """
        if not payload.get("success", False):
            raise ProductServiceException(
                payload.get("message", "product-service returned success=false")
            )
        data = payload.get("data")
        if data is None:
            return [], False

        if isinstance(data, list):
            items = data
            has_more = False
        elif isinstance(data, dict):
            items = data.get("content") or data.get("items") or []
            last = data.get("last")
            if last is None:
                # Fall back to comparing page index against totalPages
                total_pages = data.get("totalPages")
                page_number = data.get("number")
                has_more = (
                    total_pages is not None
                    and page_number is not None
                    and (page_number + 1) < total_pages
                )
            else:
                has_more = not bool(last)
        else:
            return [], False

        products: list[Product] = []
        for item in items:
            try:
                products.append(Product.model_validate(item))
            except Exception as exc:  # pragma: no cover - tolerate one bad row
                log.warning("Skipping malformed product row reason=%s", exc)
        return products, has_more


_client_singleton: Optional[ProductServiceClient] = None


def get_product_client() -> ProductServiceClient:
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = ProductServiceClient()
    return _client_singleton


def set_product_client(client: ProductServiceClient) -> None:
    """Test hook. Lets pytest inject a respx-mocked httpx client."""
    global _client_singleton
    _client_singleton = client
