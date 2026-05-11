"""Sample product dataset for tests.

Mirrors the seed in product-service/V2__Seed_Products.sql so tests
exercise the same shape of data the live catalogue will emit. Adding
extras (cheese, bread, juices) lets us exercise category-clustering
behaviour for related/FBT recommendations.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from app.models.product import Product

_NOW = datetime(2026, 5, 8, 12, 0, 0, tzinfo=timezone.utc)


def _at(days_ago: int) -> datetime:
    return _NOW - timedelta(days=days_ago)


SAMPLE_PRODUCTS: List[Product] = [
    Product(
        id=1,
        name="Amul Gold Milk 1L",
        category="Dairy",
        price=72.0,
        stock=150,
        image_url="https://cdn.example.com/products/amul-gold-1l.jpg",
        description="Full cream homogenised toned milk, 1 litre pouch",
        in_stock=True,
        created_at=_at(2),
    ),
    Product(
        id=2,
        name="Britannia Brown Bread",
        category="Bakery",
        price=45.0,
        stock=80,
        image_url="https://cdn.example.com/products/britannia-brown.jpg",
        description="Whole wheat brown bread, 400g",
        in_stock=True,
        created_at=_at(5),
    ),
    Product(
        id=3,
        name="Tata Salt 1kg",
        category="Pantry Staples",
        price=28.0,
        stock=300,
        image_url="https://cdn.example.com/products/tata-salt-1kg.jpg",
        description="Iodised refined free flow salt",
        in_stock=True,
        created_at=_at(20),
    ),
    Product(
        id=4,
        name="Aashirvaad Atta 5kg",
        category="Pantry Staples",
        price=295.0,
        stock=120,
        image_url="https://cdn.example.com/products/aashirvaad-atta.jpg",
        description="100% whole wheat atta, 5kg pack",
        in_stock=True,
        created_at=_at(15),
    ),
    Product(
        id=5,
        name="Coca Cola 750ml",
        category="Beverages",
        price=40.0,
        stock=200,
        image_url="https://cdn.example.com/products/coke-750ml.jpg",
        description="Chilled Coca Cola PET bottle",
        in_stock=True,
        created_at=_at(1),
    ),
    Product(
        id=6,
        name="Amul Cheese Slices 200g",
        category="Dairy",
        price=130.0,
        stock=60,
        image_url="https://cdn.example.com/products/amul-cheese.jpg",
        description="Processed cheese slices for sandwiches and burgers",
        in_stock=True,
        created_at=_at(7),
    ),
    Product(
        id=7,
        name="Mother Dairy Curd 400g",
        category="Dairy",
        price=45.0,
        stock=90,
        image_url="https://cdn.example.com/products/mother-dairy-curd.jpg",
        description="Fresh thick set dahi / yogurt",
        in_stock=True,
        created_at=_at(3),
    ),
    Product(
        id=8,
        name="Modern Multigrain Bread",
        category="Bakery",
        price=55.0,
        stock=70,
        image_url="https://cdn.example.com/products/modern-multigrain.jpg",
        description="Multigrain healthy bread loaf, 400g",
        in_stock=True,
        created_at=_at(4),
    ),
    Product(
        id=9,
        name="Real Mixed Fruit Juice 1L",
        category="Beverages",
        price=110.0,
        stock=140,
        image_url="https://cdn.example.com/products/real-juice.jpg",
        description="Real mixed fruit juice tetra pack 1 litre",
        in_stock=True,
        created_at=_at(10),
    ),
    Product(
        id=10,
        name="Fortune Sunflower Oil 1L",
        category="Pantry Staples",
        price=160.0,
        stock=180,
        image_url="https://cdn.example.com/products/fortune-oil.jpg",
        description="Refined sunflower cooking oil, 1 litre",
        in_stock=True,
        created_at=_at(8),
    ),
]


def sample_product_response_envelope(product: Product) -> dict:
    """Build the ApiResponse<ProductResponse> shape product-service emits."""
    return {
        "success": True,
        "message": "Product fetched successfully",
        "data": {
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "stock": product.stock,
            "imageUrl": product.image_url,
            "description": product.description,
            "inStock": product.in_stock,
            "createdAt": product.created_at.isoformat() if product.created_at else None,
        },
        "timestamp": _NOW.isoformat(),
    }


def sample_product_page_envelope(products: List[Product], page: int = 0) -> dict:
    """Build the ApiResponse<PageResponse<ProductResponse>> shape."""
    return {
        "success": True,
        "message": "Products fetched successfully",
        "data": {
            "content": [
                {
                    "id": p.id,
                    "name": p.name,
                    "category": p.category,
                    "price": p.price,
                    "stock": p.stock,
                    "imageUrl": p.image_url,
                    "description": p.description,
                    "inStock": p.in_stock,
                    "createdAt": p.created_at.isoformat() if p.created_at else None,
                }
                for p in products
            ],
            "totalPages": 1,
            "totalElements": len(products),
            "number": page,
            "size": len(products),
            "last": True,
        },
        "timestamp": _NOW.isoformat(),
    }
