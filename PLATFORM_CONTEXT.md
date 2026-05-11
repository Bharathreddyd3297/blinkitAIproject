# Blinkit Platform — Architecture Context

> **Purpose of this file.** This is the single source of architectural truth for the Blinkit microservices workspace. AI assistants (Claude, Copilot, Cursor) **MUST** read this file before performing any cross-service work — it is meant to replace open-ended folder scanning. If something here disagrees with the code, the code wins; correct this file.

---

## 1. Platform architecture

```
                         ┌──────────────────────────┐
                         │  Frontend (React) — TBD  │
                         └────────────┬─────────────┘
                                      │ HTTPS
                                      ▼
                         ┌──────────────────────────┐
                         │   API Gateway — TBD      │  (Spring Cloud Gateway / Azure API Mgmt)
                         └────────────┬─────────────┘
                                      │
   ┌──────────────┬──────────────┬────┴─────────┬──────────────┬────────────────┬──────────────────────┐
   ▼              ▼              ▼              ▼              ▼                ▼                      ▼
┌────────┐  ┌──────────┐   ┌──────────┐    ┌──────────┐   ┌──────────┐   ┌────────────┐    ┌─────────────────────┐
│  auth  │  │ product  │   │   cart   │    │  order   │   │ payment  │   │  AI reco   │    │  Redis (planned)    │
│ :8081  │  │  :8082   │   │  :8083   │    │  :8084   │   │  :8085   │   │   :TBD     │    │  cache + rate-limit │
└───┬────┘  └────┬─────┘   └────┬─────┘    └────┬─────┘   └────┬─────┘   └─────┬──────┘    └─────────────────────┘
    │           │              │               │              │              │
    ▼           ▼              ▼               ▼              ▼              ▼
┌─────────┐ ┌─────────┐  ┌──────────┐   ┌───────────┐  ┌────────────┐  ┌────────┐
│PG :5432 │ │PG :5433 │  │PG :5434  │   │PG :5435   │  │PG :5436    │  │ TBD    │
│auth DB  │ │products │  │ cart DB  │   │orders DB  │  │payments DB │  │        │
└─────────┘ └─────────┘  └──────────┘   └───────────┘  └────────────┘  └────────┘
```

**Patterns**
- Database-per-service (no cross-service SQL).
- Stateless distributed authentication via a single shared HS512 JWT secret.
- Synchronous service-to-service calls over HTTP (Spring `WebClient`); the inbound `Authorization: Bearer …` header is forwarded verbatim on every hop.
- All bodies use a uniform `ApiResponse<T>` envelope: `{success, message, data, timestamp}`.

---

## 2. Microservices and responsibilities

| Service | Port | DB | Responsibility |
|---|---|---|---|
| **auth-service** | 8081 | `blinkit_auth` | The **only** JWT issuer. Owns users + role. |
| **product-service** | 8082 | `blinkit_products` | Catalogue, inventory, ADMIN-gated mutations. |
| **cart-service** | 8083 | `blinkit_cart` | Per-user cart. Calls product-service to validate items + stock. |
| **order-service** | 8084 | `blinkit_orders` | Checkout orchestration. Calls cart-service + product-service. Creates orders, decrements inventory, clears cart. |
| **payment-service** | 8085 | `blinkit_payments` | Simulated payment lifecycle. Validates orders + updates order status via order-service. |
| **AI recommendation service** | TBD | TBD | (planned) read-only personalised product recommendations. |

Host port mapping for Postgres containers: `5432` (auth), `5433` (product), `5434` (cart), `5435` (order), `5436` (payment when wired into platform compose).

---

## 3. Distributed JWT authentication

### Trust model

- **Algorithm:** HS512 (HMAC-SHA-512).
- **Secret:** single `JWT_SECRET` env var, identical in every service. ≥ 64 bytes required by JJWT.
- **Issuer:** auth-service only. No other service signs tokens.
- **Validation:** every other service validates locally with the same secret. **No callback to auth-service**.

### Token claims (issued by auth-service)

```json
{
  "sub":     "<email>",   // legacy subject
  "userId":  <Long>,      // primary identifier used by every downstream service
  "email":   "<email>",
  "role":    "USER" | "ADMIN",
  "iat":     <epoch-seconds>,
  "exp":     <epoch-seconds>
}
```

`userId` is REQUIRED. Tokens without it are rejected with 401 by cart, order, and payment services.

### Authorization-header propagation

Every cross-service WebClient call copies the inbound `Authorization` header onto the outbound request via:

```java
ServletRequestAttributes attrs =
    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
return attrs != null ? attrs.getRequest().getHeader(HttpHeaders.AUTHORIZATION) : null;
```

The downstream service then validates the token with the same shared secret. **No service account, no token re-issue.** The original end-user's identity flows through the call chain unchanged.

### Hops in the platform

| Caller → Callee | Endpoints | Purpose |
|---|---|---|
| cart-service → product-service | `GET /api/products/{id}` | Validate item + stock at add-time |
| order-service → cart-service | `GET /api/cart`, `DELETE /api/cart/clear` | Read cart at checkout, clear post-checkout |
| order-service → product-service | `GET /api/products/{id}`, `PATCH /api/products/{id}/inventory` | Re-validate, decrement stock |
| payment-service → order-service | `GET /api/orders/{id}`, `PATCH /api/orders/{id}/status` | Validate order at create, update status at settle |

---

## 4. Shared response envelope

Every public endpoint returns `ApiResponse<T>`:

```json
{ "success": true, "message": "...", "data": <T>, "timestamp": "ISO-8601" }
```

Errors use the same shape with `success:false` plus a stable `error` code (e.g. `PRODUCT_NOT_FOUND`, `EMPTY_CART`, `INSUFFICIENT_STOCK`, `UNAUTHORIZED`, `ACCESS_DENIED`, `INTERNAL_SERVER_ERROR`).

**Cross-service WebClient rule:** when calling another service, deserialize as `ApiResponse<T>` (use `ParameterizedTypeReference`) and unwrap `.getData()`. Deserialising directly into the inner DTO will silently null every field (Jackson `@JsonIgnoreProperties(ignoreUnknown=true)`) and produce broken downstream behaviour.

---

## 5. Current API contracts (stable — do not break)

### auth-service (`/api/auth/**`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/signup` | public | `{name,email,password}` | Always creates `role=USER`. Hardcoded. |
| POST | `/login` | public | `{email,password}` | Returns `LoginResponse{accessToken,tokenType,expiresIn,user}`. |
| GET | `/me` | bearer | — | (placeholder) |
| GET | `/user/{id}` | bearer | — | |

### product-service (`/api/products/**`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `` | bearer | Paged list, optional `category`, `name` filters |
| GET | `/{id}` | bearer | |
| GET | `/category/{category}` | bearer | Paged |
| POST | `` | **ADMIN** | Create |
| PUT | `/{id}` | **ADMIN** | Update |
| PATCH | `/{id}/inventory` | **ADMIN** | `{delta:Int, reason:String}` |
| DELETE | `/{id}` | **ADMIN** | |

### cart-service (`/api/cart/**`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/add` | bearer | `{productId,quantity}` | |
| GET | `` | bearer | | Returns user-scoped cart with totals |
| PUT | `/{id}` | bearer | `{quantity}` | Owner-checked |
| DELETE | `/clear` | bearer | | |
| DELETE | `/{id}` | bearer | | Owner-checked |

### order-service (`/api/orders/**`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/checkout` | bearer | — | Orchestrates cart→product→persist→inventory→clear |
| GET | `` | bearer | — | List user orders, newest first |
| GET | `/history` | bearer | — | Same, full history |
| GET | `/{id}` | bearer | — | Owner-checked |
| PATCH | `/{id}/status` | bearer | `{status}` | Status enum: `CREATED, PAYMENT_PENDING, PAID, FAILED, CANCELLED, DELIVERED` |

### payment-service (`/api/payments/**`)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/create` | bearer | `{orderId,paymentMethod}` | Validates order via order-service, persists `PENDING` payment |
| POST | `/process` | bearer | `{paymentId, simulateStatus?}` | Simulates settlement (default 80% SUCCESS / 20% FAILED), patches order status |
| GET | `/{id}` | bearer | — | Owner-checked |
| GET | `/history` | bearer | — | |

`PaymentStatus`: `PENDING, SUCCESS, FAILED, REFUNDED`. `PaymentMethod`: `UPI, CARD, NETBANKING, WALLET, COD`.

---

## 6. Coding standards

### Layered package structure (every service)

```
com.blinkit.<service>service
├── controller   # REST controllers, thin
├── service      # Service interface + impl
│    └── impl
├── repository   # Spring Data JPA
├── entity       # JPA entities (with version columns)
├── dto          # request/response DTOs (separate Request/Response per package)
├── client       # WebClient adapters for cross-service calls
├── config       # WebClientConfig, OpenApiConfig, SecurityConfig
├── security     # JwtTokenProvider, JwtAuthenticationFilter, AuthenticatedUser, SecurityUtils
└── exception    # Domain exceptions + GlobalExceptionHandler
```

### Conventions

- **Java 21**, Spring Boot 3.3.x, Lombok, Spring Security, Spring Data JPA, Spring WebFlux (WebClient).
- All controllers thin: extract `userId` via `SecurityUtils.getCurrentUserId()`, delegate to a service interface, return `ApiResponse<T>`.
- All DTOs: `@Data @Builder @NoArgsConstructor @AllArgsConstructor`, validation annotations on requests, `@JsonIgnoreProperties(ignoreUnknown=true)` on responses.
- All exceptions inherit a typed domain exception, mapped centrally in `GlobalExceptionHandler`. **Never** return raw stack traces.
- All entities: `BIGSERIAL` IDs, `created_at` / `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`, `@Version` for optimistic locking where applicable.
- All cross-service IO via `WebClient`, configured per-callee with timeouts (5s default). Forward inbound `Authorization` header from `RequestContextHolder`.
- All schema changes via Flyway only (`src/main/resources/db/migration/V<n>__<snake_name>.sql`). `spring.jpa.hibernate.ddl-auto=validate`.
- All secrets/URLs via env vars. YAML provides safe dev-only fallbacks.
- All services expose `/actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness`, `/v3/api-docs`, `/swagger-ui.html`.

---

## 7. End-to-end ecommerce workflow

```
signup ─► login ─► (admin promote) ─► create products
                                          │
                                          ▼
                                       add to cart  ─► get cart
                                          │
                                          ▼
                                       checkout (order-service orchestrates):
                                          1. fetch cart (cart-service)
                                          2. validate items + stock (product-service)
                                          3. persist order + items (TX)
                                          4. decrement inventory (product-service)
                                          5. clear cart (cart-service)
                                          │
                                          ▼
                                       create payment (payment-service)
                                          1. validate order (order-service)
                                          2. persist PENDING payment
                                          ▼
                                       process payment (payment-service)
                                          1. simulate outcome
                                          2. patch order status (order-service)
                                                SUCCESS  → PAID
                                                FAILED   → FAILED
```

---

## 8. Docker strategy

- One Compose file per service for isolated runs (`<service>/docker-compose.yml`).
- One root file `docker-compose.platform.yml` brings up the entire platform on `blinkit-net`.
- All services use multi-stage Dockerfiles: builder = `maven:3.9-eclipse-temurin-21`, runtime = `eclipse-temurin:21-jre-alpine`. Non-root user inside the runtime image.
- Single workspace `.env` at the repo root drives every service. The `.env.example` is a template; the actual `.env` is gitignored.
- Container DNS uses service names (`auth-service`, `cart-service`, …). All Postgres host ports differ to avoid collisions (5432–5436).

---

## 9. Redis integration

**Phase 1: shipped.** product-service uses Redis as a cache-aside layer over the catalogue. Read endpoints (`GET /api/products/{id}`, `/api/products`, `/api/products/category/{category}`, search) check Redis first, fall through to Postgres on miss, and populate the cache. Mutations (create / update / delete / inventory adjust) invalidate the affected key + wildcard-evict listing keys. Cache failures fall through to Postgres — Redis outages never produce 5xx.

- Container: `redis` (image `redis:7-alpine`) on `blinkit-net`, host port 6379, AOF persistence enabled.
- Spring wiring in product-service: `RedisConfig` + `ProductCache` (single touch-point — nothing else in the service depends on `RedisTemplate`).
- Default TTL: 10 minutes.
- Key namespace: `blinkit:products:` (`:id:{id}`, `:all:p{p}:s{s}:sort{sort}`, `:category:{category}:…`, `:search:cat=…:name=…:…`).
- Operational logs at INFO level: `CACHE HIT`, `CACHE MISS - loading from DB`, `CACHE INVALIDATED`, `CACHE ERROR on read/write, falling back to DB`.

**Phase 2+: planned.** See [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md) for the full design covering:

- **cart-service:** session-style cart cache keyed by `userId`.
- **payment-service:** short-lived idempotency cache keyed by `paymentId` to dedupe `/process` retries.
- **AI recommendation service:** recommendation result cache keyed by `userId`.
- **API Gateway:** sliding-window rate limit using Redis sorted sets.

Single Redis instance, logical key prefixes per service (`product:`, `cart:`, `payment:`, `reco:`, `gw:`). Each service owns and invalidates only its own prefix.

---

## 10. AI recommendation service roadmap (planned)

- Stateless service consuming user behaviour (orders, cart adds) and the current catalogue.
- Reads `blinkit_orders` + `blinkit_products` indirectly via order-service / product-service APIs (never direct SQL).
- Caches recommendations in Redis under `reco:user:{id}:home` for 5 minutes.
- API: `GET /api/recommendations` (per-user), `GET /api/recommendations/related/{productId}` (anonymous).
- Initial implementation: heuristic / collaborative filtering. Future: vector embeddings + ANN.
- Authentication: same shared `JWT_SECRET`. No new trust model.

---

## 11. API Gateway roadmap (planned)

- Spring Cloud Gateway (preferred) or Azure API Management.
- Routes: `/api/auth/**` → auth-service, `/api/products/**` → product-service, `/api/cart/**` → cart-service, `/api/orders/**` → order-service, `/api/payments/**` → payment-service, `/api/recommendations/**` → recommendation-service.
- Pre-validates JWT to short-circuit unauthenticated traffic. Downstream services continue to validate independently — defence in depth.
- Rate limiting via Redis token-bucket / sliding window.
- TLS termination + CORS + circuit breaker.
- Single ingress for all external traffic; service-to-service stays inside the cluster.

---

## 12. AKS / Kubernetes roadmap (planned)

- Each service: its own Deployment + ClusterIP Service.
- Shared platform secrets (`JWT_SECRET`, DB credentials) in a Kubernetes `Secret` named `blinkit-platform`, mounted via `envFrom`.
- For rotation + multi-env: back the Secret with **Azure Key Vault** through the **Secrets Store CSI driver** + **workload identity**.
- PostgreSQL → **Azure Database for PostgreSQL — Flexible Server** (one logical DB per service).
- Redis → **Azure Cache for Redis** (single instance, multi-prefix).
- Liveness/Readiness probes wired to `/actuator/health/liveness` and `/readiness`.
- Ingress: Application Gateway / API Gateway exposes the platform; everything else stays internal.
- Container images published to **Azure Container Registry**.

---

## 13. Azure DevOps CI/CD roadmap (planned)

- One pipeline per service: build → test → SAST/SCA → containerize → push to ACR → tag image with commit SHA.
- A platform pipeline applies infra (Terraform) and rolls out manifests via Helm: databases → auth → product → cart → order → payment → recommendation → gateway.
- Variable groups linked to Key Vault inject build-time configuration.
- Trunk-based with PR validation; release branches per environment.

---

## 14. Current completion status

| Area | Status |
|---|---|
| auth-service | ✅ implemented + e2e validated |
| product-service | ✅ implemented + e2e validated |
| cart-service | ✅ implemented + e2e validated |
| order-service | ✅ implemented + e2e validated |
| payment-service | ✅ implemented + integrated in `docker-compose.platform.yml` |
| Shared HS512 JWT trust model | ✅ verified end-to-end |
| Database-per-service Flyway migrations | ✅ all auto-applied |
| Distributed integration tests | ✅ green for the 4-service flow (5-service full-platform run pending) |
| Root README + service READMEs | ✅ |
| Single-command full-platform bring-up | ✅ `docker compose -f docker-compose.platform.yml up --build` starts all 5 services + 5 Postgres + redis |
| Redis (Phase 1: product-service cache-aside) | ✅ implemented + smoke-tested (hit/miss/invalidate/Redis-down fallback verified) |
| Redis (Phase 2+: cart, payment, reco, gateway) | ⚠️ planned |
| AI recommendation service | ⚠️ planned, not implemented |
| API Gateway | ⚠️ planned, not implemented |
| React frontend | ⚠️ planned, not implemented |
| AKS / Terraform | ⚠️ planned |
| Azure DevOps pipelines | ⚠️ planned |

---

## 15. Hard rules for AI assistants

1. **Read this file and [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) before doing cross-service work.** Skip whole-folder scans unless something is genuinely unknown.
2. **Do not change the JWT model.** Single shared HS512 secret, claims `userId/email/role/sub`, propagation via `RequestContextHolder`.
3. **Do not break the `ApiResponse<T>` envelope.** Every cross-service consumer relies on it.
4. **Do not introduce new frameworks** (e.g. don't swap WebClient for OpenFeign, don't add Kafka unless the work item is explicitly an event-bus task).
5. **Schema changes go through Flyway only.** `ddl-auto=validate` everywhere.
6. **One service per change set when possible.** If multiple services must change for compatibility, name the contract change explicitly and explain why.
7. **Secrets via env vars only.** No hardcoded JWT secrets, no committed `.env` with real values.
8. **Never silently shrink test coverage.** If a test is removed, justify it.
