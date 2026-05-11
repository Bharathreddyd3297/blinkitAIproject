"""Domain exceptions, mapped centrally by the FastAPI exception handler.

Mirrors the platform's stable-error-code convention. Each typed exception
carries an `error` code that surfaces verbatim in the ApiResponse envelope,
so callers can branch on a stable string rather than an HTTP status alone.
"""

from __future__ import annotations


class RecommendationServiceException(Exception):
    """Base for all domain exceptions in this service."""

    error_code: str = "INTERNAL_SERVER_ERROR"
    http_status: int = 500

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ProductNotFoundException(RecommendationServiceException):
    error_code = "PRODUCT_NOT_FOUND"
    http_status = 404


class ProductServiceException(RecommendationServiceException):
    """Raised when product-service is unreachable, slow, or returns 5xx."""

    error_code = "PRODUCT_SERVICE_ERROR"
    http_status = 502


class CatalogEmptyException(RecommendationServiceException):
    """No products available — recommendations cannot be computed."""

    error_code = "CATALOG_EMPTY"
    http_status = 503


class InvalidRequestException(RecommendationServiceException):
    error_code = "BAD_REQUEST"
    http_status = 400
