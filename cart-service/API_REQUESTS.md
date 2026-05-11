# Cart Service - API Requests

All endpoints require a Bearer token issued by `auth-service`. Examples below use a `JWT` shell variable; export it first:

```bash
export JWT="<your-jwt-here>"
```

> Base URL (local): `http://localhost:8083`

---

## 1. Add item to cart

```bash
curl -X POST "http://localhost:8083/api/cart/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{
        "productId": 1,
        "quantity": 2
      }'
```

**201 Created**

```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "id": 1,
    "productId": 1,
    "productName": "Fresh Milk",
    "quantity": 2,
    "price": 55,
    "totalPrice": 110
  },
  "timestamp": "2026-05-07T22:00:00"
}
```

---

## 2. Get cart

```bash
curl -X GET "http://localhost:8083/api/cart" \
  -H "Authorization: Bearer $JWT"
```

**200 OK**

```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "userId": 42,
    "items": [
      {
        "id": 1,
        "productId": 1,
        "productName": "Fresh Milk",
        "quantity": 2,
        "price": 55,
        "totalPrice": 110
      }
    ],
    "totalItems": 1,
    "totalAmount": 110
  },
  "timestamp": "2026-05-07T22:00:00"
}
```

---

## 3. Update cart item quantity

```bash
curl -X PUT "http://localhost:8083/api/cart/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{ "quantity": 5 }'
```

**200 OK**

```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": {
    "id": 1,
    "productId": 1,
    "productName": "Fresh Milk",
    "quantity": 5,
    "price": 55,
    "totalPrice": 275
  },
  "timestamp": "2026-05-07T22:00:00"
}
```

---

## 4. Remove a cart item

```bash
curl -X DELETE "http://localhost:8083/api/cart/1" \
  -H "Authorization: Bearer $JWT"
```

**200 OK**

```json
{
  "success": true,
  "message": "Cart item removed successfully",
  "timestamp": "2026-05-07T22:00:00"
}
```

---

## 5. Clear cart

```bash
curl -X DELETE "http://localhost:8083/api/cart/clear" \
  -H "Authorization: Bearer $JWT"
```

**200 OK**

```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "timestamp": "2026-05-07T22:00:00"
}
```

---

## Health check

```bash
curl -X GET "http://localhost:8083/actuator/health"
```

**200 OK**

```json
{ "status": "UP" }
```

---

## Error examples

### Missing/invalid token (`401 Unauthorized`)

```json
{
  "success": false,
  "message": "Authentication required to access this resource",
  "error": "UNAUTHORIZED",
  "status": 401,
  "path": "/api/cart",
  "timestamp": "2026-05-07T22:00:00"
}
```

### Validation error (`400 Bad Request`)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "status": 400,
  "path": "/api/cart/add",
  "validationErrors": {
    "productId": "Product ID is required",
    "quantity": "Quantity must be greater than 0"
  },
  "timestamp": "2026-05-07T22:00:00"
}
```

### Insufficient stock (`400 Bad Request`)

```json
{
  "success": false,
  "message": "Insufficient stock for product 'Fresh Milk'. Available: 3, requested: 10",
  "error": "INSUFFICIENT_STOCK",
  "status": 400,
  "path": "/api/cart/add",
  "timestamp": "2026-05-07T22:00:00"
}
```

### Product not found (`404 Not Found`)

```json
{
  "success": false,
  "message": "Product not found with id: 999",
  "error": "PRODUCT_NOT_FOUND",
  "status": 404,
  "path": "/api/cart/add",
  "timestamp": "2026-05-07T22:00:00"
}
```
