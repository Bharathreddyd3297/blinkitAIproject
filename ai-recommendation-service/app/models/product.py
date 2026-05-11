"""Internal product model (mirrors product-service ProductResponse).

Field mapping intentionally aliases camelCase JSON (the on-the-wire shape
emitted by the JVM-based product-service) to snake_case Python. We keep
ignore-extra semantics so a future ProductResponse field addition doesn't
break this consumer — same contract as Jackson's @JsonIgnoreProperties.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Product(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )

    id: int
    name: str
    category: str
    price: float
    stock: int = 0
    image_url: Optional[str] = Field(default=None, alias="imageUrl")
    description: Optional[str] = None
    in_stock: Optional[bool] = Field(default=None, alias="inStock")
    created_at: Optional[datetime] = Field(default=None, alias="createdAt")
    updated_at: Optional[datetime] = Field(default=None, alias="updatedAt")

    def text_for_embedding(self) -> str:
        """Concatenate name, category, description into one embedding input.

        Order is name → category → description; name has the highest signal
        for short-tail e-commerce search, category provides taxonomy
        grounding, description fills out the long tail.
        """
        parts = [self.name, self.category]
        if self.description:
            parts.append(self.description)
        return " | ".join(parts)
