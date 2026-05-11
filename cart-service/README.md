# Cart Service

Production-grade Spring Boot 3 microservice that manages the shopping cart for the Blinkit-style ecommerce platform.

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

Clean, layered architecture:

```
com.blinkit.cartservice
├── controller   # REST controllers
├── service      # Business interfaces + implementations
├── repository   # Spring Data JPA repositories
├── entity       # JPA entities
├── dto          # Request / response DTOs
├── security     # JWT filter, provider, security config
├── client       # WebClient-based product-service client
├── config       # WebClient & OpenAPI configuration
└── exception    # Custom exceptions + global handler
```

## Features

1. Add item to cart (creates or merges duplicate product entries).
2. Remove item from cart.
3. Update cart item quantity.
4. View the logged-in user's cart with totals.
5. Clear the entire cart.
6. Calculate total cart value (server-side aggregation).
7. Validate product existence via `product-service`.
8. Validate stock availability before adding/updating.
9. Structured `ApiResponse<T>` JSON envelope across all endpoints.
10. Multi-product cart per user (one row per product, indexed by `user_id`).

## Service Configuration

| Property | Default |
|----------|---------|
| Server port | `8083` |
| Database | `blinkit_cart` (PostgreSQL 16) |
| JWT algorithm | `HS512` (shared secret with auth-service) |
| Product-service URL | `http://localhost:8082` |

All configuration lives in [`src/main/resources/application.yml`](src/main/resources/application.yml) and is overridable via environment variables (see `.env.example`).

## REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cart/add` | Add item to the authenticated user's cart |
| `GET` | `/api/cart` | Get the authenticated user's cart |
| `PUT` | `/api/cart/{id}` | Update quantity of a cart item |
| `DELETE` | `/api/cart/{id}` | Remove a specific cart item |
| `DELETE` | `/api/cart/clear` | Clear the entire cart |

All endpoints require an `Authorization: Bearer <jwt>` header issued by `auth-service`.

### Sample request

```json
POST /api/cart/add
{
  "productId": 1,
  "quantity": 2
}
```

### Sample response

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

For full curl examples see [API_REQUESTS.md](API_REQUESTS.md).

## Health & Observability

- Health probe: `GET /actuator/health`
- Liveness/Readiness: `GET /actuator/health/liveness`, `GET /actuator/health/readiness`
- Metrics: `GET /actuator/metrics`, `GET /actuator/prometheus`
- OpenAPI JSON: `GET /v3/api-docs`
- Swagger UI: `GET /swagger-ui.html`

## Running Locally

### Option 1 — Maven (requires local PostgreSQL on port 5432)

```bash
cp .env.example .env
mvn clean spring-boot:run
```

### Option 2 — Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

The service is then available at `http://localhost:8083`. PostgreSQL is exposed on host port `5433`.

## Database Migrations

Schema is managed by Flyway and applied automatically on startup.

- Migrations live in [`src/main/resources/db/migration`](src/main/resources/db/migration).
- Initial migration: `V1__create_cart_items_table.sql` — creates `cart_items` table plus `idx_cart_user_id` and `idx_cart_product_id` indexes.

## Security

- All `/api/cart/**` endpoints require a valid JWT.
- JWT tokens are validated using the **HS512** algorithm with a shared secret (`JWT_SECRET`).
- Expired, malformed, unsupported, or invalid-signature tokens are rejected with `401 Unauthorized`.
- The authenticated user is exposed to controllers/services via `SecurityUtils.getCurrentUser()` / `SecurityUtils.getCurrentUserId()`.
- The forwarded `Authorization` header is propagated by `ProductServiceClient` to `product-service` so downstream auth checks succeed.

## Product Service Integration

`ProductServiceClient` uses `WebClient` to call:

```
GET {PRODUCT_SERVICE_BASE_URL}/api/products/{id}
```

The response is mapped to `ProductResponse` and is used to:

- Verify the product exists (404 → `ProductNotFoundException`).
- Pull the latest name and unit price for snapshotting in the cart.
- Validate stock before persisting cart changes (`InsufficientStockException` if requested qty exceeds availability or stock is `<= 0`).
- Surface upstream failures via `ProductServiceException` (`503 Service Unavailable`).

## Error Handling

Global exception handler in [`GlobalExceptionHandler`](src/main/java/com/blinkit/cartservice/exception/GlobalExceptionHandler.java) maps:

| Exception | HTTP | Error code |
|-----------|------|------------|
| `ProductNotFoundException` | 404 | `PRODUCT_NOT_FOUND` |
| `CartItemNotFoundException` | 404 | `CART_ITEM_NOT_FOUND` |
| `InsufficientStockException` | 400 | `INSUFFICIENT_STOCK` |
| `MethodArgumentNotValidException` | 400 | `VALIDATION_ERROR` |
| `IllegalArgumentException` | 400 | `BAD_REQUEST` |
| `UnauthorizedException` / `AuthenticationException` | 401 | `UNAUTHORIZED` / `AUTHENTICATION_FAILED` |
| `InvalidTokenException` | 401 | `INVALID_TOKEN` |
| `AccessDeniedException` | 403 | `ACCESS_DENIED` |
| `ProductServiceException` | 503 | `PRODUCT_SERVICE_ERROR` |
| `Exception` (fallback) | 500 | `INTERNAL_SERVER_ERROR` |

## Project Layout

```
cart-service/
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── .dockerignore
├── README.md
├── API_REQUESTS.md
└── src/main/
    ├── java/com/blinkit/cartservice/
    │   ├── CartServiceApplication.java
    │   ├── controller/CartController.java
    │   ├── service/CartService.java
    │   ├── service/impl/CartServiceImpl.java
    │   ├── repository/CartItemRepository.java
    │   ├── entity/CartItem.java
    │   ├── dto/request/{AddCartRequest, UpdateCartRequest}.java
    │   ├── dto/response/{ApiResponse, CartItemResponse, CartResponse, ProductResponse}.java
    │   ├── security/{JwtTokenProvider, JwtAuthenticationFilter, JwtAuthenticationEntryPoint, SecurityConfig, SecurityUtils, AuthenticatedUser}.java
    │   ├── client/ProductServiceClient.java
    │   ├── config/{WebClientConfig, OpenApiConfig}.java
    │   └── exception/*.java
    └── resources/
        ├── application.yml
        └── db/migration/V1__create_cart_items_table.sql
```
