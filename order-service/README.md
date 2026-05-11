# Order Service

Production-grade Spring Boot 3 microservice that handles checkout, order creation, status tracking, and order history for the Blinkit-style ecommerce platform.

It is the orchestration layer of the platform — it does not own products or carts, but it composes them into orders by calling `cart-service` and `product-service` over HTTP, propagating the end-user's JWT downstream.

## Tech Stack

- **Java 21**
- **Spring Boot 3.3.x**
- **Spring Web / Spring Data JPA / Spring Security / Spring WebFlux (WebClient)**
- **PostgreSQL 16**
- **Flyway** (database migrations)
- **JWT (HS512)** via [`jjwt`](https://github.com/jwtk/jjwt)
- **Lombok**
- **springdoc-openapi (Swagger UI)**
- **Maven**
- **Docker / Docker Compose**

## Architecture

Clean, layered architecture matching the rest of the platform:

```
com.blinkit.orderservice
├── controller   # REST controllers
├── service      # Business interfaces + implementations
├── repository   # Spring Data JPA repositories
├── entity       # JPA entities (Order, OrderItem) + OrderStatus enum
├── dto          # Request / response DTOs
├── security     # JWT filter, provider, security config, AuthenticatedUser
├── client       # WebClient adapters: CartServiceClient, ProductServiceClient
├── config       # WebClient & OpenAPI configuration
└── exception    # Custom exceptions + global handler
```

### Where order-service sits in the platform

```
React Frontend
      │
      ▼
   API Gateway
      │
      ▼
┌──────────────────────────────────────────────────────────┐
│  auth-service     ── issues JWT (HS512)                  │
│  product-service  ── catalogue + inventory               │
│  cart-service     ── per-user cart, calls product-svc    │
│  order-service ◄  ── checkout, calls cart + product-svc  │ (this service)
└──────────────────────────────────────────────────────────┘
      │
      ▼
PostgreSQL (blinkit_orders) + Redis (future)
```

Each service has its own database (database-per-service pattern). All services share a single `JWT_SECRET` so any service can independently validate any token issued by `auth-service` — no per-request callback to `auth-service` is needed.

## Features

1. Checkout the authenticated user's cart and create a new order.
2. Re-validate every product still exists and has enough stock at checkout time.
3. Persist order + order items in a single DB transaction.
4. Reduce inventory on `product-service` after the order is saved (best-effort).
5. Clear the cart on `cart-service` after the order is saved (best-effort).
6. List the authenticated user's orders.
7. Fetch a specific order's details (ownership-checked).
8. Update an order's status (`CREATED → PAYMENT_PENDING → PAID / FAILED / CANCELLED / DELIVERED`).
9. Full order history for the authenticated user, newest first.
10. Structured `ApiResponse<T>` JSON envelope across all endpoints.
11. Structured JSON `ErrorResponse` for every failure mode with stable error codes.

## Service Configuration

| Property | Default |
|----------|---------|
| Server port | `8084` |
| Database | `blinkit_orders` (PostgreSQL 16) |
| JWT algorithm | `HS512` (shared secret with auth-service) |
| Cart-service URL | `http://localhost:8083` |
| Product-service URL | `http://localhost:8082` |

All configuration lives in [`src/main/resources/application.yml`](src/main/resources/application.yml) and is overridable via environment variables (see `.env.example`). No secret is hardcoded.

## REST API

All endpoints require an `Authorization: Bearer <jwt>` header issued by `auth-service`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/orders/checkout` | Checkout the authenticated user's cart and create an order |
| `GET` | `/api/orders` | List the authenticated user's orders (newest first) |
| `GET` | `/api/orders/history` | Full order history for the authenticated user |
| `GET` | `/api/orders/{id}` | Get a specific order owned by the authenticated user |
| `PATCH` | `/api/orders/{id}/status` | Update the status of an order |

### Sample checkout response

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
      }
    ],
    "createdAt": "2026-05-08T10:00:00",
    "updatedAt": "2026-05-08T10:00:00"
  },
  "timestamp": "2026-05-08T10:00:00"
}
```

For full curl examples see [API_REQUESTS.md](API_REQUESTS.md).

## Checkout Workflow

The `POST /api/orders/checkout` endpoint runs this orchestration end-to-end:

1. **JWT validated** by `JwtAuthenticationFilter`; `AuthenticatedUser` populated in `SecurityContext`.
2. **Extract userId** from the security context via `SecurityUtils.getCurrentUserId()`.
3. **Fetch the user's cart** by calling `GET {CART_SERVICE_BASE_URL}/api/cart` with the inbound `Authorization` header forwarded.
4. **Reject empty carts** with `400 Bad Request` (`EMPTY_CART`).
5. **Re-validate every product** by calling `GET {PRODUCT_SERVICE_BASE_URL}/api/products/{id}` per item. Missing → `404 PRODUCT_NOT_FOUND`.
6. **Validate stock** for each item against the live `stock` field. Insufficient → `400 INSUFFICIENT_STOCK`.
7. **Persist order + items** in one DB transaction with status = `CREATED` and a server-side computed `totalAmount` snapshot.
8. **Reduce inventory** for each item via `PATCH {PRODUCT_SERVICE_BASE_URL}/api/products/{id}/inventory` with negative `delta`. Failures are logged and do not roll back the saved order — reconciliation is the responsibility of the platform's payment / saga layer.
9. **Clear the cart** via `DELETE {CART_SERVICE_BASE_URL}/api/cart/clear`. Same best-effort semantics as inventory adjust.
10. **Return** the persisted order wrapped in `ApiResponse<OrderResponse>`.

## JWT Propagation

`order-service` does not issue tokens — it only verifies and forwards them.

```
client ──Authorization: Bearer <jwt>──► order-service
                                          │
                                          │ (same Authorization header copied verbatim)
                                          ▼
                                   cart-service / product-service
```

- `JwtTokenProvider` loads `JWT_SECRET` and verifies HS512 signatures.
- `JwtAuthenticationFilter` parses claims (`userId`, `email`, `role`) and populates the `SecurityContext`.
- `CartServiceClient` and `ProductServiceClient` copy the inbound `Authorization` header onto every outbound WebClient request via `RequestContextHolder`. The downstream service validates it with the **same** `JWT_SECRET`. No service account, no token re-issue.

This is identical to the propagation pattern used by `cart-service → product-service`.

## Microservice Communication

`order-service` calls two upstream services on every checkout:

| Upstream | URL | Used for |
|----------|-----|----------|
| `cart-service` | `${CART_SERVICE_BASE_URL}` | `GET /api/cart` (fetch cart), `DELETE /api/cart/clear` (post-checkout) |
| `product-service` | `${PRODUCT_SERVICE_BASE_URL}` | `GET /api/products/{id}` (validate), `PATCH /api/products/{id}/inventory` (reduce stock) |

Both clients use Spring `WebClient` configured in `WebClientConfig` with separate base URLs and a shared timeout configuration. Each client translates HTTP failures into typed exceptions (`CartServiceException`, `ProductServiceException`, `ProductNotFoundException`) which are then mapped to structured `ErrorResponse` payloads by `GlobalExceptionHandler`.

## Health & Observability

- Health probe: `GET /actuator/health`
- Liveness/Readiness: `GET /actuator/health/liveness`, `GET /actuator/health/readiness`
- Metrics: `GET /actuator/metrics`, `GET /actuator/prometheus`
- OpenAPI JSON: `GET /v3/api-docs`
- Swagger UI: `GET /swagger-ui.html`

The Kubernetes-ready liveness/readiness probes work out of the box — wire them into your AKS Deployment manifest.

## Running Locally

### Option 1 — Maven (requires PostgreSQL on host port 5432, plus running cart-service + product-service)

```bash
cp .env.example .env
mvn clean spring-boot:run
```

### Option 2 — Docker Compose (recommended for the whole stack)

From the workspace root:

```bash
cp .env.example .env
docker compose -f docker-compose.platform.yml up --build
```

The service is then available at `http://localhost:8084`. PostgreSQL is exposed on host port `5435`.

## Database Migrations

Schema is managed by Flyway and applied automatically on startup.

- Migrations live in [`src/main/resources/db/migration`](src/main/resources/db/migration).
- Initial migration: `V1__create_orders_tables.sql` — creates `orders` and `order_items` tables with `idx_orders_user_id`, `idx_orders_status`, `idx_order_items_order_id`, `idx_order_items_product_id` indexes and a foreign key from `order_items.order_id` to `orders.id`.

`spring.jpa.hibernate.ddl-auto: validate` ensures Hibernate never silently mutates the schema.

## Security

- All `/api/orders/**` endpoints require a valid JWT.
- JWT tokens are validated using **HS512** with a shared secret (`JWT_SECRET`).
- Expired, malformed, unsupported, or invalid-signature tokens are rejected with `401 Unauthorized`.
- The authenticated user is exposed to controllers/services via `SecurityUtils.getCurrentUser()` / `SecurityUtils.getCurrentUserId()`.
- The forwarded `Authorization` header is propagated by `CartServiceClient` and `ProductServiceClient` to their respective upstream services so downstream auth checks succeed.
- Ownership checks: `getOrderById` and `updateOrderStatus` reject access to orders that do not belong to the authenticated user (`401 UNAUTHORIZED`).

## Error Handling

Global exception handler in [`GlobalExceptionHandler`](src/main/java/com/blinkit/orderservice/exception/GlobalExceptionHandler.java) maps:

| Exception | HTTP | Error code |
|-----------|------|------------|
| `OrderNotFoundException` | 404 | `ORDER_NOT_FOUND` |
| `ProductNotFoundException` | 404 | `PRODUCT_NOT_FOUND` |
| `EmptyCartException` | 400 | `EMPTY_CART` |
| `InsufficientStockException` | 400 | `INSUFFICIENT_STOCK` |
| `MethodArgumentNotValidException` | 400 | `VALIDATION_ERROR` |
| `IllegalArgumentException` | 400 | `BAD_REQUEST` |
| `UnauthorizedException` / `AuthenticationException` | 401 | `UNAUTHORIZED` / `AUTHENTICATION_FAILED` |
| `InvalidTokenException` | 401 | `INVALID_TOKEN` |
| `AccessDeniedException` | 403 | `ACCESS_DENIED` |
| `CartServiceException` | 503 | `CART_SERVICE_ERROR` |
| `ProductServiceException` | 503 | `PRODUCT_SERVICE_ERROR` |
| `Exception` (fallback) | 500 | `INTERNAL_SERVER_ERROR` |

## AKS / Kubernetes Notes

The service is deployment-ready for AKS with no code changes:

- Configuration is fully env-var driven; map a `Secret` named e.g. `blinkit-platform` into the Deployment's env.
- `JWT_SECRET` is read at startup from `JWT_SECRET`; project it from a Kubernetes Secret or Azure Key Vault.
- `SPRING_DATASOURCE_URL` should point at Azure Database for PostgreSQL Flexible Server.
- Wire `livenessProbe` to `/actuator/health/liveness` and `readinessProbe` to `/actuator/health/readiness`.
- Internal DNS (`http://cart-service:8083`, `http://product-service:8082`) replaces the local `localhost:*` defaults seamlessly because both URLs are env-var driven.

## Project Layout

```
order-service/
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .dockerignore
├── README.md
├── API_REQUESTS.md
└── src/main/
    ├── java/com/blinkit/orderservice/
    │   ├── OrderServiceApplication.java
    │   ├── controller/OrderController.java
    │   ├── service/OrderService.java
    │   ├── service/impl/OrderServiceImpl.java
    │   ├── repository/{OrderRepository, OrderItemRepository}.java
    │   ├── entity/{Order, OrderItem, OrderStatus}.java
    │   ├── dto/request/UpdateOrderStatusRequest.java
    │   ├── dto/response/{ApiResponse, OrderResponse, OrderItemResponse, CartResponse, CartItemResponse, ProductResponse}.java
    │   ├── security/{JwtTokenProvider, JwtAuthenticationFilter, JwtAuthenticationEntryPoint, SecurityConfig, SecurityUtils, AuthenticatedUser}.java
    │   ├── client/{CartServiceClient, ProductServiceClient}.java
    │   ├── config/{WebClientConfig, OpenApiConfig}.java
    │   └── exception/{ErrorResponse, GlobalExceptionHandler, OrderNotFoundException, EmptyCartException, ProductNotFoundException, InsufficientStockException, CartServiceException, ProductServiceException, UnauthorizedException, InvalidTokenException}.java
    └── resources/
        ├── application.yml
        └── db/migration/V1__create_orders_tables.sql
```
