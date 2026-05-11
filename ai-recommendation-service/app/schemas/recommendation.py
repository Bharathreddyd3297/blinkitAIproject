"""Public-facing recommendation DTOs.

`RecommendationItem` is the sole shape the service emits. It is intentionally
slim — just enough for the frontend to render a tile (id, name, category,
optional image, similarity score). Internal product attributes (stock,
description embeddings) are kept out of the response.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RecommendationItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    name: str
    category: str
    price: Optional[float] = None
    image_url: Optional[str] = Field(default=None, alias="imageUrl")
    score: float = Field(description="Similarity / ranking score in [0, 1]")
    reason: Optional[str] = Field(
        default=None,
        description="Human-readable justification ('same category', 'similar to X')",
    )
