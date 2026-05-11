# payment-service

Payment microservice for the Blinkit-style ecommerce platform. Owns the
**simulated** payment lifecycle (no real Razorpay/Stripe SDK), persists every
transaction, and orchestrates the corresponding order-status update on
`order-service`.

| | |
|---|---|
| **Stack** | Java 21, Spring Boot 3.3.5, Maven, Spring Security, Spring Data JPA, Spring WebFlux WebClient, Flyway, PostgreSQL, JJWT, springdoc-openapi |
| **Default port** | `8085` |
| **Database** | `blinkit_payments` (Postgres host port `5436` in Docker) |
| **Auth model** | Stateless JWT (HS512), shared secret with `auth-service` / `product-service` / `cart-service` / `order-service` |
| **Downstream** | `order-service` (`http://localhost:8084`) — fetch order, update status |

---

## Where this fits in the platform

```
React frontend
     │
API Gateway
     │
 ┌───┴────────────────────────────────────────────────┐
 │ auth-service (8081)   product-service (8082)       │
 │ cart-service (8083)   order-service   (8084)       │
 │ payment-service (8085) ◄── this service            │
 │ ai-recommendation-service                          │
 └────────────────────────────────────────────────────┘
     │
PostgreSQL  +  Redis (Redis-ready, not yet wired here)
```

`payment-service` is the **only** service in the platform that issues simulated
gateway transactions and reflects their outcome back onto an order. It
deliberately does not touch `cart-service` or `product-service` — those are
already settled by the time `order-service` has produced an order id.

---

## Payment workflow

The full happy-path flow from a frontend POV:

1. **Authenticate** — frontend obtains a JWT from `auth-service`.
2. **Checkout** — frontend posts to `order-service` `/api/orders/checkout`,
   which produces an order with status `CREATED` and a `totalAmount`.
3. **Create payment** — frontend posts the `orderId` + `paymentMethod` to
   `POST /api/payments/create` on **this** service.
   - `payment-service` validates the JWT locally (shared secret).
   - It calls `GET /api/orders/{id}` on `order-service`, **forwarding the
     same Authorization header** so order-service authorises against the
     same user.
   - It persists a `PENDING` `payments` row with `amount = order.totalAmount`.
4. **Process payment** — frontend posts the new `paymentId` to
   `POST /api/payments/process`.
   - The simulator picks an outcome:
     - if the request body contains `simulateStatus` (must be `SUCCESS` or
       `FAILED`), that value is used verbatim;
     - otherwise the service draws from the configured success-rate
       distribution (default **80% SUCCESS / 20% FAILED**, configurable via
       `PAYMENT_SUCCESS_RATE_PERCENT`).
     - `COD` always settles as SUCCESS in automatic mode (cash collected on
       delivery).
   - A synthetic `transactionId` of the form `TXN-yyyyMMdd-HHmmss-NNNNNN` is
     generated and persisted along with the new status.
   - The service then PATCHes `order-service` `/api/orders/{id}/status`:
     - `SUCCESS → PAID`
     - `FAILED  → FAILED`
   - This downstream call is **best-effort** — if `order-service` is
     unreachable, the `payments` row is already correct and the platform's
     reconciliation layer is expected to re-drive the order update. The
     payment call itself never rolls back from a downstream failure.
5. **Inspect** — `GET /api/payments/{id}` and `GET /api/payments/history`
   return strictly user-scoped payment records.

### Status lifecycle

```
        ┌──────────┐
        │ PENDING  │  ← created by POST /api/payments/create
        └────┬─────┘
             │ POST /api/payments/process
   ┌─────────┴──────────┐
   ▼                    ▼
┌───────┐           ┌────────┐
│SUCCESS│           │ FAILED │
└───┬───┘           └────────┘
    │
    │ (future) refund flow
    ▼
┌────────┐
│REFUND. │  ← REFUNDED slot is reserved in the enum for future expansion
└────────┘
```

---

## JWT propagation (distributed-trust model)

Every protected endpoint requires `Authorization: Bearer <jwt>`. The token is
issued by **`auth-service`**, signed with HS512 using a secret that **all**
services share (env var `JWT_SECRET`).

`payment-service`:

- **validates** the inbound token locally in `JwtTokenProvider` — never calls
  `auth-service` synchronously;
- extracts `userId`, `email`, `role` from the claims and puts them in the
  Spring `SecurityContext` (see `JwtAuthenticationFilter`,
  `AuthenticatedUser`);
- **forwards** the original `Authorization` header verbatim to `order-service`
  on every outbound WebClient call (see `OrderServiceClient`). This is what
  lets `order-service` enforce its own ownership check on
  `GET /api/orders/{id}` against the same user.

In Kubernetes / AKS the `JWT_SECRET` env var will be projected from a
Kubernetes Secret / Azure Key Vault — **no code change is needed**.

> Make sure `JWT_SECRET` here is **byte-for-byte identical** to the value used
> by the other services. A mismatched secret will silently 401 every request.

---

## order-service integration

| Operation | Method & path | When |
|---|---|---|
| Fetch order  | `GET /api/orders/{id}` | At create-payment, to validate the order exists and snapshot `totalAmount` |
| Update order | `PATCH /api/orders/{id}/status` body `{"status":"PAID"\|"FAILED"}` | At process-payment, after settlement |

Both calls forward the inbound JWT via the `Authorization` header. `order-service`
returns `ApiResponse<OrderResponse>`, which is unwrapped by the WebClient
adapter using a `ParameterizedTypeReference`. The adapter maps:

- `404` → `OrderNotFoundException` (HTTP 404 to the original caller)
- 4xx   → `OrderServiceException` (HTTP 503)
- 5xx   → `OrderServiceException` (HTTP 503)
- network errors → `OrderServiceException` (HTTP 503)

See `OrderServiceClient` for the exact behaviour.

---

## Running locally

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET to the platform's shared HS512 secret.
docker compose up --build
```

This launches:

- `blinkit-payment-postgres` on host port **5436** (container 5432). On first
  boot it auto-creates the `blinkit_payments` database via `init-db.sql`.
- `blinkit-payment-service` on host port **8085**, with Flyway migrating the
  `payments` table.

The compose file expects `order-service` to be reachable at
`http://order-service:8084` on the shared `blinkit-net` network. Bring up
`order-service` (and its dependencies) on the same network, or run the
root-level `docker-compose.platform.yml` for the full stack.

### Option B — Maven, against a local Postgres

```bash
# Postgres must already have a 'blinkit_payments' database.
export JWT_SECRET=...                  # same secret as the rest of the platform
export ORDER_SERVICE_BASE_URL=http://localhost:8084
mvn spring-boot:run
```

### Verifying

```bash
curl -fsS http://localhost:8085/actuator/health
# {"status":"UP", ...}
```

Open Swagger UI at <http://localhost:8085/swagger-ui.html>.

---

## Configuration

All knobs are env-var driven (see `application.yml` and `.env.example`):

| Env var | Default | Purpose |
|---|---|---|
| `SERVER_PORT` | `8085` | HTTP port |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/blinkit_payments` | DB JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | DB user |
| `SPRING_DATASOURCE_PASSWORD` | `postgres` | DB password |
| `JWT_SECRET` | dev-only fallback | HS512 secret — **must match the rest of the platform** |
| `ORDER_SERVICE_BASE_URL` | `http://localhost:8084` | order-service base URL |
| `PAYMENT_SUCCESS_RATE_PERCENT` | `80` | Automatic-mode success rate (0..100) |

---

## Observability

- **Health**: `GET /actuator/health` (`liveness` / `readiness` probes enabled
  out of the box for AKS).
- **Metrics**: `GET /actuator/metrics`, Prometheus at `/actuator/prometheus`.
- **OpenAPI**: JSON at `/v3/api-docs`, Swagger UI at `/swagger-ui.html`.
- All controller, service, security and WebClient calls log via SLF4J at
  INFO/DEBUG with structured fields (`userId`, `paymentId`, `orderId`).

---

## API surface

See [`API_REQUESTS.md`](./API_REQUESTS.md) for full curl examples.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/payments/create`  | Create a `PENDING` payment for an order |
| `POST` | `/api/payments/process` | Simulate settlement; updates order-service |
| `GET`  | `/api/payments/{id}`    | Get a payment owned by the authenticated user |
| `GET`  | `/api/payments/history` | List the authenticated user's payments, newest first |

All endpoints require `Authorization: Bearer <jwt>` and respond with the
platform's standard `ApiResponse<T>` envelope.

---

## Project layout

```
payment-service/
├── Dockerfile
├── docker-compose.yml
├── init-db.sql                                  # creates blinkit_payments on first volume init
├── .env.example
├── pom.xml
├── README.md
├── API_REQUESTS.md
└── src/main/
    ├── java/com/blinkit/paymentservice/
    │   ├── PaymentServiceApplication.java
    │   ├── client/        OrderServiceClient
    │   ├── config/        WebClientConfig, OpenApiConfig
    │   ├── controller/    PaymentController
    │   ├── dto/
    │   │   ├── request/   CreatePaymentRequest, ProcessPaymentRequest, UpdateOrderStatusRequest
    │   │   └── response/  ApiResponse, PaymentResponse, OrderResponse
    │   ├── entity/        Payment, PaymentStatus, PaymentMethod
    │   ├── exception/     ErrorResponse, GlobalExceptionHandler, *Exception
    │   ├── repository/    PaymentRepository
    │   ├── security/      JwtTokenProvider, JwtAuthenticationFilter, JwtAuthenticationEntryPoint, SecurityConfig, AuthenticatedUser, SecurityUtils
    │   └── service/       PaymentService + impl/PaymentServiceImpl
    └── resources/
        ├── application.yml
        └── db/migration/V1__create_payments_table.sql
```

---

## Test-application notice

This service **simulates** payment processing. It does **not** integrate with
Razorpay, Stripe, or any real PSP. Production deployment would replace
`PaymentServiceImpl#determineOutcome` and `#generateTransactionId` with a real
gateway adapter (Stripe Payment Intents, Razorpay Orders, etc.) — every other
layer (auth, persistence, JWT propagation, order-service orchestration,
observability) is already production-style.
