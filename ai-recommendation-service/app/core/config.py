"""Centralised env-driven configuration.

All knobs flow through environment variables, with safe dev defaults
so the service still boots locally without a populated .env. Mirrors the
"secrets/URLs via env vars" rule the rest of the platform follows.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ----- Service identity -----
    service_name: str = Field(default="ai-recommendation-service")
    service_port: int = Field(default=8090)
    log_level: str = Field(default="INFO")
    environment: Literal["dev", "staging", "prod", "test"] = Field(default="dev")

    # ----- product-service integration -----
    product_service_base_url: str = Field(
        default="http://product-service:8082",
        description="Base URL for product-service. Use Docker DNS in compose, localhost outside.",
    )
    product_service_timeout_seconds: float = Field(default=5.0)
    product_service_page_size: int = Field(default=100)
    product_service_max_pages: int = Field(default=10)

    internal_service_jwt: Optional[str] = Field(
        default=None,
        description=(
            "Optional bearer token used as a fallback when no inbound Authorization "
            "header is present. Useful for warm-up jobs and local development."
        ),
    )

    # ----- Redis -----
    redis_host: str = Field(default="redis")
    redis_port: int = Field(default=6379)
    redis_db: int = Field(default=0)
    redis_password: Optional[str] = Field(default=None)
    redis_socket_timeout_seconds: float = Field(default=2.0)
    redis_key_prefix: str = Field(default="reco")

    # ----- TTLs (seconds) -----
    ttl_trending_seconds: int = Field(default=300)         # 5 min
    ttl_related_seconds: int = Field(default=3600)         # 1 hour
    ttl_frequently_bought_seconds: int = Field(default=3600)  # 1 hour
    ttl_user_seconds: int = Field(default=300)             # 5 min
    ttl_catalog_snapshot_seconds: int = Field(default=600) # 10 min, in-memory only

    # ----- Recommendation tuning -----
    related_top_k: int = Field(default=5)
    frequently_bought_top_k: int = Field(default=5)
    trending_top_k: int = Field(default=10)
    user_top_k: int = Field(default=10)

    # ----- Embeddings -----
    embedding_model_name: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    embedding_backend: Literal["sentence_transformers", "tfidf", "auto"] = Field(
        default="auto",
        description=(
            "auto = try sentence-transformers, fall back to TF-IDF on failure. "
            "Force tfidf in CI / lightweight environments."
        ),
    )
    embedding_cache_size: int = Field(default=10_000)


@lru_cache
def get_settings() -> Settings:
    return Settings()
