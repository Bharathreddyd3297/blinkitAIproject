# API Requests — ai-recommendation-service

Ready-to-paste examples for every endpoint. Replace `$TOKEN` with a JWT obtained from `auth-service`'s `/api/auth/login`. The recommendation service itself does not validate inbound JWTs in Phase-1, but the token is forwarded to `product-service` (which does require it for `GET /api/products`).

Base URL inside the platform compose: `http://localhost:8090`.

---

## 1. Health

### Liveness
```bash
curl -s http://localhost:8090/health/liveness
```
```json
{ "status": "UP" }
```

### Aggregate
```bash
curl -s http://localhost:8090/health
```
```json
{
  "status": "UP",
  "service": "ai-recommendation-service",
  "version": "1.0.0",
  "components": {
    "redis":          { "status": "UP" },
    "productService": { "status": "UP", "code": 200 }
  }
}
```

### Readiness (returns 503 if Redis or product-service is down)
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8090/health/readiness
```

---

## 2. Trending

```bash
curl -s "http://localhost:8090/api/recommendations/trending?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```
```json
{
  "success": true,
  "message": "Trending products fetched successfully",
  "data": [
    {
      "id": 5,
      "name": "Coca Cola 750ml",
      "category": "Beverages",
      "price": 40.0,
      "imageUrl": "https://cdn.example.com/products/coke-750ml.jpg",
      "score": 0.92,
      "reason": "High stock and recently listed"
    },
    {
      "id": 1,
      "name": "Amul Gold Milk 1L",
      "category": "Dairy",
      "price": 72.0,
      "score": 0.81,
      "reason": "High stock and recently listed"
    }
  ],
  "timestamp": "2026-05-08T12:00:00+00:00"
}
```

Cache key: `reco:trending` · TTL: 5 minutes.

---

## 3. Related products

```bash
curl -s "http://localhost:8090/api/recommendations/related/1?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```
```json
{
  "success": true,
  "message": "Related products fetched successfully",
  "data": [
    {
      "id": 7,
      "name": "Mother Dairy Curd 400g",
      "category": "Dairy",
      "price": 45.0,
      "score": 0.78,
      "reason": "Semantically similar to 'Amul Gold Milk 1L'"
    },
    {
      "id": 6,
      "name": "Amul Cheese Slices 200g",
      "category": "Dairy",
      "price": 130.0,
      "score": 0.72,
      "reason": "Semantically similar to 'Amul Gold Milk 1L'"
    }
  ],
  "timestamp": "2026-05-08T12:00:00+00:00"
}
```

Cache key: `reco:related:1` · TTL: 1 hour.

### Anchor product not found
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8090/api/recommendations/related/9999" \
  -H "Authorization: Bearer $TOKEN"
# 404
```
```json
{
  "success": false,
  "message": "Product 9999 not in current catalogue snapshot",
  "error": "PRODUCT_NOT_FOUND",
  "status": 404,
  "path": "/api/recommendations/related/9999"
}
```

---

## 4. Frequently bought together

```bash
curl -s "http://localhost:8090/api/recommendations/frequently-bought/1?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```
```json
{
  "success": true,
  "message": "Frequently bought together fetched successfully",
  "data": [
    {
      "id": 7,
      "name": "Mother Dairy Curd 400g",
      "category": "Dairy",
      "price": 45.0,
      "score": 0.74,
      "reason": "Often bought with 'Amul Gold Milk 1L'"
    },
    {
      "id": 6,
      "name": "Amul Cheese Slices 200g",
      "category": "Dairy",
      "price": 130.0,
      "score": 0.69,
      "reason": "Often bought with 'Amul Gold Milk 1L'"
    }
  ],
  "timestamp": "2026-05-08T12:00:00+00:00"
}
```

Cache key: `reco:fbt:1` · TTL: 1 hour.

---

## 5. Personalised user recommendations

```bash
curl -s "http://localhost:8090/api/recommendations/user/42?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq
```
```json
{
  "success": true,
  "message": "Personalized recommendations fetched successfully",
  "data": [
    {
      "id": 3,
      "name": "Tata Salt 1kg",
      "category": "Pantry Staples",
      "price": 28.0,
      "score": 0.97,
      "reason": "Matches your preference for Pantry Staples"
    },
    {
      "id": 4,
      "name": "Aashirvaad Atta 5kg",
      "category": "Pantry Staples",
      "price": 295.0,
      "score": 0.84,
      "reason": "Matches your preference for Pantry Staples"
    }
  ],
  "timestamp": "2026-05-08T12:00:00+00:00"
}
```

Cache key: `reco:user:42` · TTL: 5 minutes.

---

## 6. Diagnostics

### Cache hit/miss/error counters
```bash
curl -s http://localhost:8090/api/recommendations/_diag/cache-stats | jq
```
```json
{
  "success": true,
  "message": "Cache stats",
  "data": {
    "hits": 12,
    "misses": 4,
    "errors": 0,
    "prefix": "reco"
  },
  "timestamp": "2026-05-08T12:00:00+00:00"
}
```

### OpenAPI / Swagger UI
- Swagger UI: `http://localhost:8090/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8090/v3/api-docs`
- ReDoc: `http://localhost:8090/redoc`

---

## 7. Smoke flow against the running platform

```bash
# 1. Login (auth-service)
TOKEN=$(curl -s -X POST http://localhost:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@blinkit.test","password":"demo1234"}' \
  | jq -r '.data.accessToken')

# 2. Trending — first call computes, second call hits cache
curl -s "http://localhost:8090/api/recommendations/trending" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
curl -s "http://localhost:8090/api/recommendations/trending" \
  -H "Authorization: Bearer $TOKEN" | jq '.success'

# 3. Related to product 1
curl -s "http://localhost:8090/api/recommendations/related/1" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[].name'

# 4. Bring Redis down — service still serves
docker stop blinkit-redis
curl -s "http://localhost:8090/api/recommendations/trending" \
  -H "Authorization: Bearer $TOKEN" | jq '.success'   # still true
docker start blinkit-redis
```

The Redis-down step exercises the cache-aside fallback documented in [README.md §3](README.md) and verified by `tests/test_cache.py::TestRedisDownFallback`.
