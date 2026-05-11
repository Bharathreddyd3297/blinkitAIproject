"""Structured logging configuration.

Each log line includes a timestamp, level, logger name, and message.
Operational keys mirror product-service log vocabulary (CACHE HIT,
CACHE MISS, CACHE INVALIDATED, CACHE ERROR) so platform-wide grep
patterns work across services.
"""

from __future__ import annotations

import logging
import sys
from logging.config import dictConfig

from app.core.config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": (
                        "%(asctime)s | %(levelname)-5s | %(name)s | "
                        "%(message)s"
                    ),
                    "datefmt": "%Y-%m-%dT%H:%M:%S",
                },
            },
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "stream": sys.stdout,
                    "formatter": "default",
                },
            },
            "loggers": {
                "uvicorn": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
                "uvicorn.error": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
                "uvicorn.access": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
                "httpx": {"handlers": ["stdout"], "level": "WARNING", "propagate": False},
                "httpcore": {"handlers": ["stdout"], "level": "WARNING", "propagate": False},
            },
            "root": {
                "handlers": ["stdout"],
                "level": settings.log_level.upper(),
            },
        }
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
