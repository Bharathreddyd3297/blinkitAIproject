# Order Service - API Requests

All endpoints require a Bearer token issued by `auth-service`. Examples below use a `JWT` shell variable; export it first:

```bash
export JWT="<your-jwt-here>"
```

> Base URL (local): `http://localhost:8084`

---

## 1. Checkout cart

Converts the authenticated user's current cart (fetched live from `cart-service`) into a new order, validates each line item against `product-service`, persists the order, reduces inventory, and clears the cart.

```bash
curl -X POST "http://localhost:8084/api/orders/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT"
```

**201 Created**

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "orderId": 1,
    "userId": 42,
    "status": "CREATED",
    "totalAmount": 450,
    "items": [
      {
        "id": 1,
        "productId": 7,
        "productName": "Fresh Milk",
        "quantity": 2,
        "price": 55,
        "totalPrice": 110
      },
      {
        "id": 2,
        "productId": 12,
        "productName": "Whole Wheat Bread",
        "quantity": 1,
        "price": 340,
        "totalPrice": 340
      }
    ],
    "createdAt": "2026-05-08T10:00:00",
    "updatedAt": "2026-05-08T10:00:00"
  },
  "timestamp": "2026-05-08T10:00:00"
}
```

---

## 2. List my orders

Returns every order the authenticated user has placed, newest first.

```bash
curl -X GET "http://localhost:8084/api/orders" \
  -H "Authorization: Bearer $JWT"
```

**200 OK**

```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
      "orderId": 2,
      "userId": 42,
      "status": "PAID",
      "totalAmount": 220,
      "items": [
        {
          "id": 3,
          "productId": 7,
          "productName": "Fresh Milk",
          "quantity": 4,
          "price": 55,
          "totalPrice": 220
        }
      ],
      "createdAt": "2026-05-08T11:30:00",
      "updatedAt": "2026-05-08T11:32:11"
    },
    {
      "orderId": 1,
      "userId": 42,
      "status": "CREATED",
      "totalAmount": 450,
      "items": [],
      "createdAt": "2026-05-08T10:00:00",
      "updatedAt": "2026-05-08T10:00:00"
    }
  ],
  "timestamp": "2026-05-08T11:35:00"
}
```

---

## 3. Get a specific order

```bash
curl -X GET "http://localhost:8084/api/orders/1" \
  -H "Authorization: Bearer $JWT"
```

**200 OK**

```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "orderId": 1,
    "userId": 42,
    "status": "CREATED",
    "totalAmount": 450,
    "items": [
      {
        "id": 1,
        "productId": 7,
        "productName": "Fresh Milk",
        "quantity": 2,
        "price": 55,
        "totalPrice": 110
      }
    ],
    "createdAt": "2026-05-08T10:00:00",
    "updatedAt": "2026-05-08T10:00:00"
  },
  "timestamp": "2026-05-08T10:05:00"
}
```

---

## 4. Update order status

Allowed values: `CREATED`, `PAYMENT_PENDING`, `PAID`, `FAILED`, `CANCELLED`, `DELIVERED`.

```bash
curl -X PATCH "http://localhost:8084/api/orders/1/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{ "status": "PAYMENT_PENDING" }'
```

**200 OK**

```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "orderId": 1,
    "userId": 42,
    "status": "PAYMENT_PENDING",
    "totalAmount": 450,
    "items": [],
    "createdAt": "2026-05-08T10:00:00",
    "updatedAt": "2026-05-08T10:07:42"
  },
  "timestamp": "2026-05-08T10:07:42"
}
```

---

## 5. Order history

```bash
curl -X GET "http://localhost:8084/api/orders/history" \
  -H "Authorization: Bearer $JWT"
```

**200 OK**

Same shape as `GET /api/orders` — returns every order placed by the authenticated user, newest first.

---

## Health check

```bash
curl -X GET "http://localhost:8084/actuator/health"
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
  "path": "/api/orders/checkout",
  "timestamp": "2026-05-08T10:00:00"
}
```

### Empty cart at checkout (`400 Bad Request`)

```json
{
  "success": false,
  "message": "Cannot checkout an empty cart",
  "error": "EMPTY_CART",
  "status": 400,
  "path": "/api/orders/checkout",
  "timestamp": "2026-05-08T10:00:00"
}
```

### Insufficient stock at checkout (`400 Bad Request`)

```json
{
  "success": false,
  "message": "Insufficient stock for product 'Fresh Milk'. Available: 3, requested: 10",
  "error": "INSUFFICIENT_STOCK",
  "status": 400,
  "path": "/api/orders/checkout",
  "timestamp": "2026-05-08T10:00:00"
}
```

### Product no longer exists (`404 Not Found`)

```json
{
  "success": false,
  "message": "Product not found with id: 999",
  "error": "PRODUCT_NOT_FOUND",
  "status": 404,
  "path": "/api/orders/checkout",
  "timestamp": "2026-05-08T10:00:00"
}
```

### Order does not exist (`404 Not Found`)

```json
{
  "success": false,
  "message": "Order not found with id: 999",
  "error": "ORDER_NOT_FOUND",
  "status": 404,
  "path": "/api/orders/999",
  "timestamp": "2026-05-08T10:00:00"
}
```

### Trying to access someone else's order (`401 Unauthorized`)

```json
{
  "success": false,
  "message": "You are not allowed to view this order",
  "error": "UNAUTHORIZED",
  "status": 401,
  "path": "/api/orders/1",
  "timestamp": "2026-05-08T10:00:00"
}
```

### Validation error on status update (`400 Bad Request`)

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "status": 400,
  "path": "/api/orders/1/status",
  "validationErrors": {
    "status": "Order status is required"
  },
  "timestamp": "2026-05-08T10:00:00"
}
```

### Upstream service down (`503 Service Unavailable`)

```json
{
  "success": false,
  "message": "Unable to reach cart-service: Connection refused",
  "error": "CART_SERVICE_ERROR",
  "status": 503,
  "path": "/api/orders/checkout",
  "timestamp": "2026-05-08T10:00:00"
}
```
