# Service Summaries

> One-pager per service. Read this instead of opening every `controller/`, `service/`, `entity/` directory. If you need depth, the linked `README.md` and source paths are below.

---

## auth-service

**Path:** [auth-service/](auth-service/) · **Port:** 8081 · **DB:** `blinkit_auth`

### Responsibility
Sole JWT issuer for the platform. Owns user identity, password hashing, role assignment.

### APIs
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | public | hardcodes `role=USER` |
| POST | `/api/auth/login` | public | returns `{accessToken, tokenType, expiresIn, user}` |
| GET | `/api/auth/me` | bearer | placeholder |
| GET | `/api/auth/user/{id}` | bearer | |

### Database
`users(id BIGSERIAL PK, name, email UNIQUE, password, role, is_active, created_at, updated_at)`. Indexed on `email`, `is_active`. Flyway: `V1__Initial_Schema.sql`.

### Integrations
None outbound. Purely a token issuer.

### Security
- HS512 signing with shared `JWT_SECRET` (≥ 64 bytes).
- Token claims: `sub=email, userId, email, role, iat, exp`.
- `JwtAuthenticationFilter` validates incoming tokens for `/api/auth/me`, `/api/auth/user/**`.
- BCrypt password hashing.

### Constraints
- **`POST /signup` always sets `role=USER`.** ADMIN promotion is currently out of band (SQL update). A bootstrap mechanism is a planned improvement.
- **Token lifetime:** `JWT_EXPIRATION` ms env var (default 86_400_000 = 24h).

---

## product-service

**Path:** [product-service/](product-service/) · **Port:** 8082 · **DB:** `blinkit_products`

### Responsibility
Product catalogue + inventory authority. Source of truth for product data and stock counts.

### APIs
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/products` | bearer | paged, filters `category`, `name` |
| GET | `/api/products/{id}` | bearer | |
| GET | `/api/products/category/{category}` | bearer | paged |
| POST | `/api/products` | **ADMIN** | |
| PUT | `/api/products/{id}` | **ADMIN** | |
| PATCH | `/api/products/{id}/inventory` | **ADMIN** | `{delta:Int, reason:String}` — used by order-service post-checkout |
| DELETE | `/api/products/{id}` | **ADMIN** | |

### Database
`products(id BIGSERIAL PK, name, category, price NUMERIC(10,2), stock INT, image_url, description, version BIGINT, created_at, updated_at)`. Flyway: `V1__Initial_Schema.sql`, `V2__Seed_Products.sql` (5 seed rows, idempotent).

### Integrations
None outbound today. Inventory mutations are driven *by* order-service over HTTP.

### Cache (Phase 1 — shipped)
- **Redis** via `spring-boot-starter-data-redis`, single touch-point class [`cache/ProductCache.java`](product-service/src/main/java/com/blinkit/productservice/cache/ProductCache.java).
- Cache-aside on all read endpoints (`/api/products/{id}`, `/api/products`, `/api/products/category/{c}`, search).
- Default TTL 10 minutes. Keys under namespace `blinkit:products:` (`:id:{id}`, `:all:p…s…sort…`, `:category:{c}:…`, `:search:…`).
- Every mutation (`createProduct`, `updateProduct`, `deleteProduct`, `adjustInventory`) calls `productCache.invalidateAllProductCaches(id, reason)` which `DEL`s the by-id key + `SCAN+UNLINK`s all listing patterns.
- Connection: `${REDIS_HOST:localhost}` / `${REDIS_PORT:6379}` — in Compose this resolves to the `redis` service via Docker DNS.
- Cache failures **never produce 5xx**. On Redis outage, reads degrade to direct-Postgres and writes log + skip the invalidation.
- Operational logs: `CACHE HIT`, `CACHE MISS - loading from DB`, `CACHE INVALIDATED`, `CACHE ERROR on read/write, falling back to DB`.

### Security
- Token validation only (`JwtTokenProvider.validateToken`).
- `@PreAuthorize("hasRole('ADMIN')")` on all mutation endpoints.

### Constraints
- **Inventory adjust is the only legitimate mutation path during a transaction**; do not write to `stock` from any other service.
- Optimistic locking via `@Version` — concurrent stock decrements safe.
- Treat `GET /api/products/{id}` as the canonical authority used by cart and order services.
- **Redis is a cache, not a database.** Postgres remains the source of truth — anything not in Redis is never authoritative, and any write must hit Postgres before invalidating the cache.

---

## cart-service

**Path:** [cart-service/](cart-service/) · **Port:** 8083 · **DB:** `blinkit_cart`

### Responsibility
Per-user cart. Validates each item against the live product catalogue.

### APIs
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/cart/add` | bearer | `{productId, quantity}` |
| GET | `/api/cart` | bearer | returns cart with totals |
| PUT | `/api/cart/{id}` | bearer | `{quantity}`, owner-checked |
| DELETE | `/api/cart/clear` | bearer | called by order-service after checkout |
| DELETE | `/api/cart/{id}` | bearer | owner-checked |

### Database
`cart_items(id BIGSERIAL PK, user_id, product_id, product_name, quantity, price NUMERIC(10,2), total_price NUMERIC(10,2), created_at, updated_at)`, `quantity > 0` check. Indexed on `user_id`, `product_id`. Flyway: `V1__create_cart_items_table.sql`.

### Integrations
**→ product-service** via `WebClient` (`ProductServiceClient`):
- `GET /api/products/{id}` on every `add`/`update` to validate and price.
- Authorization header forwarded from `RequestContextHolder`.
- Body deserialized as `ApiResponse<ProductResponse>`, then `.data`. **Do not deserialize directly into `ProductResponse`** — fields will be null.

### Security
- `JwtAuthenticationFilter` reads `userId` from JWT claims and builds `AuthenticatedUser`.
- `SecurityUtils.getCurrentUserId()` is the only way controllers should fetch the user.
- Throws `UnauthorizedException` if `userId` is null in claims.

### Constraints
- `cart-service` does NOT mutate inventory. It only validates stock at add-time.
- Cart is best-effort persistent — order-service expects it may be cleared by other paths (TTL once Redis lands).

---

## order-service

**Path:** [order-service/](order-service/) · **Port:** 8084 · **DB:** `blinkit_orders`

### Responsibility
Checkout orchestration. Owns the order lifecycle.

### APIs
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/orders/checkout` | bearer | full orchestration in one call |
| GET | `/api/orders` | bearer | newest first |
| GET | `/api/orders/history` | bearer | full history |
| GET | `/api/orders/{id}` | bearer | owner-checked |
| PATCH | `/api/orders/{id}/status` | bearer | called by payment-service |

### Database
- `orders(id, user_id, status, total_amount, created_at, updated_at)`
- `order_items(id, order_id FK, product_id, product_name, quantity, price, total_price)`

`OrderStatus`: `CREATED, PAYMENT_PENDING, PAID, FAILED, CANCELLED, DELIVERED`.

Flyway: `V1__create_orders_tables.sql`. Indexed on `user_id`, `status`, `order_items.order_id`, `product_id`.

### Integrations
- **→ cart-service:** `GET /api/cart`, `DELETE /api/cart/clear`. Body unwrapped as `ApiResponse<CartResponse>`.
- **→ product-service:** `GET /api/products/{id}` per item, then `PATCH /api/products/{id}/inventory` post-persist. Inventory call is best-effort with logging — failure does NOT roll back the order. (Outbox pattern is the planned hardening.)

### Security
- Same JWT validation as cart.
- Owner-checks on `getOrderById` and `updateOrderStatus`.

### Constraints
- **Order persistence is transactional**; inventory decrement and cart clear are intentionally **outside** the TX (best-effort, idempotent).
- `PATCH /api/orders/{id}/status` is callable by the user; payment-service calls it on the user's behalf using the user's JWT (no service account).

---

## payment-service

**Path:** [payment-service/](payment-service/) · **Port:** 8085 · **DB:** `blinkit_payments`

### Responsibility
Simulated payment lifecycle. Decoupled from order creation: explicit two-phase flow (`/create` then `/process`).

### APIs
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/payments/create` | bearer | `{orderId, paymentMethod}` — validates order via order-service, persists `PENDING` payment |
| POST | `/api/payments/process` | bearer | `{paymentId, simulateStatus?}` — simulates settlement, patches order status |
| GET | `/api/payments/{id}` | bearer | owner-checked |
| GET | `/api/payments/history` | bearer | newest first |

`PaymentStatus`: `PENDING, SUCCESS, FAILED, REFUNDED`.
`PaymentMethod`: `UPI, CARD, NETBANKING, WALLET, COD`.

### Database
`payments(id, order_id, user_id, amount NUMERIC(10,2), status, transaction_id, payment_method, created_at, updated_at)`, `amount >= 0`. Indexed on `order_id`, `user_id`, `status`. Flyway: `V1__create_payments_table.sql`.

### Integrations
- **→ order-service:** `GET /api/orders/{id}` to validate that the order belongs to the user before creating a payment; `PATCH /api/orders/{id}/status` after settlement (`SUCCESS → PAID`, `FAILED → FAILED`).
- Authorization header forwarded from `RequestContextHolder`.

### Security
- Token validated locally via shared `JWT_SECRET`.
- Owner-checks on `/process`, `/{id}`.

### Constraints
- **Simulated**: there is no external PSP. `app.payment.success-rate-percent` (env `PAYMENT_SUCCESS_RATE_PERCENT`, default 80) controls the random outcome when `simulateStatus` is not provided.
- `/process` is *not* idempotent yet. A duplicate `/process` on the same `paymentId` will be the next obvious place to add a Redis idempotency cache (see [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md)).
- `PATCH /api/orders/{id}/status` is best-effort — payment can be marked `SUCCESS` while the order's status update fails. Same outbox pattern recommended for hardening.

---

## What's NOT yet a service

| Planned | Status |
|---|---|
| AI recommendation service | not started |
| API Gateway | not started |
| React frontend | not started |
| Redis (Phase 1: product-service cache-aside) | ✅ shipped |
| Redis (Phase 2: cart / payment / reco / gateway rate-limiting) | not started — see [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md) |
