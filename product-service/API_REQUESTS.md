# Product Service — Sample API Requests

Base URL (local): `http://localhost:8082`

All product endpoints require a valid `Bearer <JWT>` issued by **auth-service**.
Mutation endpoints (POST / PUT / PATCH / DELETE) additionally require role `ADMIN`.

---

## 0. Obtain a JWT from auth-service

```bash
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@blinkit.com",
    "password": "Admin@123"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "type": "Bearer",
  ...
}
```

Export it for the rest of the calls:
```bash
export TOKEN="eyJhbGciOiJIUzUxMiJ9..."
```

---

## 1. Health endpoint (public)

```bash
curl http://localhost:8082/actuator/health
```

---

## 2. Add product (ADMIN)

```bash
curl -X POST http://localhost:8082/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mother Dairy Curd 1kg",
    "category": "Dairy",
    "price": 90.00,
    "stock": 50,
    "imageUrl": "https://cdn.example.com/products/md-curd-1kg.jpg",
    "description": "Fresh thick curd, 1kg pack"
  }'
```

`201 Created` with `Location: /api/products/{id}` header.

---

## 3. Get all products (paginated)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8082/api/products?page=0&size=10&sort=name,asc"
```

---

## 4. Get product by ID

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8082/api/products/1
```

---

## 5. Update product (ADMIN)

```bash
curl -X PUT http://localhost:8082/api/products/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amul Gold Milk 1L",
    "category": "Dairy",
    "price": 75.00,
    "stock": 200,
    "imageUrl": "https://cdn.example.com/products/amul-gold-1l.jpg",
    "description": "Updated price"
  }'
```

---

## 6. Delete product (ADMIN)

```bash
curl -X DELETE http://localhost:8082/api/products/1 \
  -H "Authorization: Bearer $TOKEN"
```

`204 No Content`.

---

## 7. Filter products by category

Path-based:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8082/api/products/category/Dairy?page=0&size=10"
```

Query-based (combined search):
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8082/api/products?category=Dairy&name=milk"
```

---

## 8. Inventory tracking — adjust stock (ADMIN)

Decrement stock (e.g. order placed):
```bash
curl -X PATCH http://localhost:8082/api/products/1/inventory \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": -5,
    "reason": "ORDER_FULFILLMENT order#1042"
  }'
```

Increment stock (restock):
```bash
curl -X PATCH http://localhost:8082/api/products/1/inventory \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delta": 100,
    "reason": "RESTOCK PO#7781"
  }'
```

Going below zero returns `409 Conflict` with `INSUFFICIENT_STOCK`.

---

## Error response shape

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Product not found with identifier: 999",
  "status": 404,
  "timestamp": "2026-05-07T10:24:00",
  "path": "/api/products/999"
}
```

Validation failures additionally include an `errors` map keyed by field name.
