"""Platform-wide ApiResponse<T> envelope.

Every Blinkit microservice returns the same shape on success and failure.
Cross-service consumers deserialize as ApiResponse<T> first, then read
.data — never inline the inner DTO directly (Jackson silently nulls
unknown fields on the JVM side).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ApiResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(populate_by_name=True)

    success: bool
    message: str
    data: Optional[T] = None
    error: Optional[str] = None
    status: Optional[int] = None
    path: Optional[str] = None
    timestamp: str = Field(default_factory=_now_iso)

    @classmethod
    def ok(cls, data: T, message: str = "OK") -> "ApiResponse[T]":
        return cls(success=True, message=message, data=data)

    @classmethod
    def fail(
        cls,
        message: str,
        error: str,
        status: int,
        path: Optional[str] = None,
    ) -> "ApiResponse[None]":
        return cls(
            success=False,
            message=message,
            error=error,
            status=status,
            path=path,
        )
