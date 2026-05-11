# payment-service — API request examples

All endpoints are protected. Get a JWT from `auth-service` first and export it:

```bash
export TOKEN=<paste your JWT here>
export BASE=http://localhost:8085
```

The service expects (and forwards downstream) the standard
`Authorization: Bearer <jwt>` header. All bodies and responses are JSON wrapped
in the platform's `ApiResponse<T>` envelope:

```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "timestamp": "2026-05-08T12:00:00"
}
```

---

## 1. Create a payment

`POST /api/payments/create` — validates the order against `order-service` and
persists a `PENDING` payment row. Does **not** settle the payment.

### Request

```bash
curl -fsS -X POST "$BASE/api/payments/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 1,
    "paymentMethod": "UPI"
  }'
```

`paymentMethod` ∈ `UPI | CARD | NETBANKING | WALLET | COD`.

### Response — `201 Created`

```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "paymentId": 1,
    "orderId": 1,
    "userId": 42,
    "status": "PENDING",
    "amount": 450.00,
    "paymentMethod": "UPI",
    "createdAt": "2026-05-08T12:00:00",
    "updatedAt": "2026-05-08T12:00:00"
  },
  "timestamp": "2026-05-08T12:00:00"
}
```

### Failure modes

| Condition | Status | error code |
|---|---|---|
| Missing/invalid JWT | `401` | `UNAUTHORIZED` |
| Order does not exist on order-service | `404` | `ORDER_NOT_FOUND` |
| Order belongs to another user | `401` | `UNAUTHORIZED` |
| order-service unreachable | `503` | `ORDER_SERVICE_ERROR` |
| Validation (missing orderId / paymentMethod) | `400` | `VALIDATION_ERROR` |

---

## 2. Process a payment (simulated)

`POST /api/payments/process` — settles a previously-created `PENDING` payment.

### A. Automatic simulation (default 80% SUCCESS / 20% FAILED)

```bash
curl -fsS -X POST "$BASE/api/payments/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": 1
  }'
```

### B. Explicit override

```bash
curl -fsS -X POST "$BASE/api/payments/process" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": 1,
    "simulateStatus": "FAILED"
  }'
```

`simulateStatus` must be `SUCCESS` or `FAILED` if provided; any other value
returns `400 BAD_REQUEST`.

### Response — `200 OK` (success path)

```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "paymentId": 1,
    "orderId": 1,
    "userId": 42,
    "transactionId": "TXN-20260508-120015-487213",
    "status": "SUCCESS",
    "amount": 450.00,
    "paymentMethod": "UPI",
    "createdAt": "2026-05-08T12:00:00",
    "updatedAt": "2026-05-08T12:00:15"
  },
  "timestamp": "2026-05-08T12:00:15"
}
```

On `SUCCESS`, payment-service issues:

```
PATCH http://order-service:8084/api/orders/1/status
Authorization: Bearer <forwarded JWT>
Content-Type: application/json

{"status":"PAID"}
```

On `FAILED`, the same call is made with `{"status":"FAILED"}`. If
order-service is unreachable, the payment record stays correct and a warning
is logged — the response to the original caller still reflects the persisted
payment state.

### Failure modes

| Condition | Status | error code |
|---|---|---|
| Payment not found | `404` | `PAYMENT_NOT_FOUND` |
| Payment owned by another user | `401` | `UNAUTHORIZED` |
| Payment already settled (not `PENDING`) | `400` | `INVALID_ORDER` |
| `simulateStatus` not in `{SUCCESS, FAILED}` | `400` | `BAD_REQUEST` |
| Missing/invalid JWT | `401` | `UNAUTHORIZED` |

---

## 3. Get a payment by id

`GET /api/payments/{id}` — strictly scoped to the authenticated user.

```bash
curl -fsS "$BASE/api/payments/1" \
  -H "Authorization: Bearer $TOKEN"
```

### Response — `200 OK`

```json
{
  "success": true,
  "message": "Payment retrieved successfully",
  "data": {
    "paymentId": 1,
    "orderId": 1,
    "userId": 42,
    "transactionId": "TXN-20260508-120015-487213",
    "status": "SUCCESS",
    "amount": 450.00,
    "paymentMethod": "UPI",
    "createdAt": "2026-05-08T12:00:00",
    "updatedAt": "2026-05-08T12:00:15"
  },
  "timestamp": "2026-05-08T12:00:30"
}
```

### Failure modes

| Condition | Status | error code |
|---|---|---|
| No such payment | `404` | `PAYMENT_NOT_FOUND` |
| Payment belongs to another user | `401` | `UNAUTHORIZED` |
| Missing/invalid JWT | `401` | `UNAUTHORIZED` |

---

## 4. Payment history

`GET /api/payments/history` — newest first.

```bash
curl -fsS "$BASE/api/payments/history" \
  -H "Authorization: Bearer $TOKEN"
```

### Response — `200 OK`

```json
{
  "success": true,
  "message": "Payment history retrieved successfully",
  "data": [
    {
      "paymentId": 2,
      "orderId": 7,
      "userId": 42,
      "transactionId": "TXN-20260508-130201-302118",
      "status": "FAILED",
      "amount": 220.50,
      "paymentMethod": "CARD",
      "createdAt": "2026-05-08T13:02:00",
      "updatedAt": "2026-05-08T13:02:01"
    },
    {
      "paymentId": 1,
      "orderId": 1,
      "userId": 42,
      "transactionId": "TXN-20260508-120015-487213",
      "status": "SUCCESS",
      "amount": 450.00,
      "paymentMethod": "UPI",
      "createdAt": "2026-05-08T12:00:00",
      "updatedAt": "2026-05-08T12:00:15"
    }
  ],
  "timestamp": "2026-05-08T13:05:00"
}
```

---

## 5. Standard error envelope

Any failure path returns the platform's standard error body:

```json
{
  "success": false,
  "message": "Order not found with id: 999",
  "error": "ORDER_NOT_FOUND",
  "status": 404,
  "path": "/api/payments/create",
  "timestamp": "2026-05-08T12:00:00"
}
```

For validation failures, an additional `validationErrors` map is included:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "status": 400,
  "path": "/api/payments/create",
  "validationErrors": {
    "orderId": "orderId is required",
    "paymentMethod": "paymentMethod is required (UPI, CARD, NETBANKING, WALLET, COD)"
  },
  "timestamp": "2026-05-08T12:00:00"
}
```

---

## End-to-end smoke test

```bash
# 1) Auth (token from auth-service)
TOKEN=$(curl -fsS http://localhost:8081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret"}' \
  | jq -r '.data.token')

# 2) Checkout an order (order-service)
ORDER_ID=$(curl -fsS -X POST http://localhost:8084/api/orders/checkout \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data.orderId')

# 3) Create a payment (this service)
PAYMENT_ID=$(curl -fsS -X POST http://localhost:8085/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderId\": $ORDER_ID, \"paymentMethod\": \"UPI\"}" \
  | jq -r '.data.paymentId')

# 4) Force-succeed the payment (this service)
curl -fsS -X POST http://localhost:8085/api/payments/process \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"paymentId\": $PAYMENT_ID, \"simulateStatus\": \"SUCCESS\"}" | jq

# 5) Confirm the order is now PAID on order-service
curl -fsS http://localhost:8084/api/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.data.status'
# "PAID"
```
