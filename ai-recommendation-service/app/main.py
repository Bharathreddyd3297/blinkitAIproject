"""FastAPI app entrypoint.

Composition order matters:
  1. Logging is configured *before* anything else logs.
  2. Singletons (Redis, product-service client, embedding service) are
     created on `startup` so the first request doesn't pay for connect
     latency.
  3. The exception handler maps every domain exception (and unexpected
     `Exception`) into the platform-wide ApiResponse envelope — no raw
     stack traces ever reach the client.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app import __version__
from app.api.health import router as health_router
from app.api.recommendations import router as recommendations_router
from app.cache.redis_cache import get_cache
from app.clients.product_client import get_product_client
from app.core.config import get_settings
from app.core.exceptions import RecommendationServiceException
from app.core.logging import configure_logging, get_logger
from app.schemas.api_response import ApiResponse

configure_logging()
log = get_logger("ai-recommendation-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect Redis + product-service before the first request lands."""
    settings = get_settings()
    log.info(
        "STARTUP - service=%s version=%s port=%s env=%s",
        settings.service_name,
        __version__,
        settings.service_port,
        settings.environment,
    )

    cache = get_cache()
    await cache.connect()

    product_client = get_product_client()
    await product_client.connect()

    try:
        yield
    finally:
        log.info("SHUTDOWN - draining clients")
        await product_client.close()
        await cache.close()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Blinkit AI Recommendation Service",
        description=(
            "Internal platform intelligence layer — trending, related, "
            "frequently-bought-together, and per-user product "
            "recommendations powered by sentence-transformer embeddings "
            "and a Redis cache-aside layer."
        ),
        version=__version__,
        lifespan=lifespan,
        docs_url="/swagger-ui.html",
        redoc_url="/redoc",
        openapi_url="/v3/api-docs",
    )

    # CORS is owned by the api-gateway (it's the only public ingress and
    # the platform trust boundary). Adding CORS here too makes the gateway
    # response carry two `Access-Control-Allow-Origin` values (`*` from us
    # plus the gateway's specific origin), which browsers reject. Anything
    # talking to this service in-cluster is non-browser (the gateway,
    # service-to-service calls), so no middleware is needed.

    app.include_router(health_router)
    app.include_router(recommendations_router)

    _register_exception_handlers(app)
    _register_request_logger(app)

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "service": settings.service_name,
            "version": __version__,
            "docs": "/swagger-ui.html",
        }

    return app


def _register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RecommendationServiceException)
    async def domain_handler(
        request: Request, exc: RecommendationServiceException
    ) -> JSONResponse:
        log.warning(
            "DOMAIN ERROR - path=%s code=%s msg=%s",
            request.url.path,
            exc.error_code,
            exc.message,
        )
        return _envelope_error(
            message=exc.message,
            error=exc.error_code,
            status_code=exc.http_status,
            path=request.url.path,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        log.warning(
            "VALIDATION ERROR - path=%s errors=%s",
            request.url.path,
            exc.errors(),
        )
        return _envelope_error(
            message="Request validation failed",
            error="VALIDATION_ERROR",
            status_code=422,
            path=request.url.path,
        )

    @app.exception_handler(Exception)
    async def fallback_handler(request: Request, exc: Exception) -> JSONResponse:
        # Never leak a stack trace to the client — log it server-side instead.
        log.exception("UNHANDLED ERROR - path=%s", request.url.path)
        return _envelope_error(
            message="Internal server error",
            error="INTERNAL_SERVER_ERROR",
            status_code=500,
            path=request.url.path,
        )


def _envelope_error(*, message: str, error: str, status_code: int, path: str) -> JSONResponse:
    body = ApiResponse.fail(
        message=message, error=error, status=status_code, path=path
    ).model_dump(exclude_none=True)
    return JSONResponse(status_code=status_code, content=body)


def _register_request_logger(app: FastAPI) -> None:
    @app.middleware("http")
    async def log_requests(
        request: Request, call_next: Callable[[Request], Awaitable[JSONResponse]]
    ):
        import time

        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        log.info(
            "REQUEST - %s %s status=%s elapsed_ms=%.1f",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response


app = create_app()


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=False,
    )
