# Blinkit Microservices Platform

A capstone-grade Spring Boot 3 microservices workspace simulating an instant-commerce ("Blinkit-style") platform — auth, catalogue, cart, orders, payments — with a single shared HS512 JWT trust model, database-per-service Postgres, full Docker orchestration, and a clear path to Azure Kubernetes Service.

> 📚 **For AI assistants and new contributors:** start with [PLATFORM_CONTEXT.md](PLATFORM_CONTEXT.md), [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md), and [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) instead of scanning the whole tree.

---

## Architecture at a glance

```
                       ┌──────────────────────────────┐
                       │   Frontend (React) — TBD     │
                       └──────────────┬───────────────┘
                                      │ HTTPS
                                      ▼
                       ┌──────────────────────────────┐
                       │   API Gateway — TBD          │
                       └──────────────┬───────────────┘
                                      │
   ┌──────────────┬──────────────┬────┴─────────┬──────────────┬──────────────┬──────────────────┐
   ▼              ▼              ▼              ▼              ▼              ▼                  ▼
┌────────┐  ┌──────────┐   ┌──────────┐    ┌──────────┐   ┌──────────┐   ┌────────────┐     ┌──────────────────┐
│  auth  │  │ product  │   │   cart   │    │  order   │   │ payment  │   │  AI reco   │     │ Redis (planned)  │
│  8081  │  │   8082   │   │   8083   │    │   8084   │   │   8085   │   │    TBD     │     │ cache + RL       │
└───┬────┘  └────┬─────┘   └────┬─────┘    └────┬─────┘   └────┬─────┘   └─────┬──────┘     └──────────────────┘
    │           │              │               │              │              │
    ▼           ▼              ▼               ▼              ▼              ▼
┌─────────┐ ┌─────────┐  ┌──────────┐   ┌───────────┐  ┌────────────┐  ┌────────────┐
│PG :5432 │ │PG :5433 │  │PG :5434  │   │PG :5435   │  │PG :5436    │  │ PG / cache │
│ auth DB │ │products │  │ cart DB  │   │ orders DB │  │payments DB │  │   TBD      │
└─────────┘ └─────────┘  └──────────┘   └───────────┘  └────────────┘  └────────────┘
```

**Architecture in one paragraph:** five Spring Boot 3 microservices share one HS512 JWT secret, one response envelope (`ApiResponse<T>`), and one Postgres-per-service pattern. They communicate over HTTP with `WebClient`, propagating the inbound `Authorization: Bearer …` header on every cross-service hop. auth-service signs; everyone else verifies locally. There is no service account, no callback to auth-service, and no shared database.

---

## Workspace layout

```
blinkit-clone/
├── README.md                          # ← you are here
├── PLATFORM_CONTEXT.md                # master architecture context (read first)
├── SERVICE_SUMMARIES.md               # one-pager per service
├── AI_ASSISTANT_GUIDE.md              # rules for Claude / Copilot / Cursor
├── REDIS_INTEGRATION_PLAN.md          # forward-looking Redis design
├── .env.example                       # workspace env template
├── docker-compose.platform.yml        # full-stack orchestration (all 5 services + 5 Postgres + Redis)
│
├── auth-service/                      # JWT issuer                (port 8081)
├── product-service/                   # catalogue + inventory     (port 8082)
├── cart-service/                      # per-user cart             (port 8083)
├── order-service/                     # checkout orchestration    (port 8084)
└── payment-service/                   # simulated payments        (port 8085)
```

Each service has its own `README.md`, `Dockerfile`, `docker-compose.yml` (for isolated runs), `pom.xml`, `src/`, and Flyway migrations under `src/main/resources/db/migration/`.

---

## Quick start

```bash
# 1. Create your local .env (the example secret is intentionally short
#    and will fail HS512 — replace with a 64+ byte secret for any real run).
cp .env.example .env

# 2. Bring up the full platform — 5 services + 5 dedicated Postgres in one command.
docker compose -f docker-compose.platform.yml up --build
```

That single command starts every container in the platform (11 in total: `auth-service`, `product-service`, `cart-service`, `order-service`, `payment-service`, the five `postgres-*` databases, and `blinkit-redis`) on the shared `blinkit-net` Docker network. Service-to-service hostnames inside the network match the compose service keys (`auth-service`, `product-service`, …, `redis`) — no `localhost` references survive into container land.

Once everything is healthy:

| Service | URL | Health |
|---|---|---|
| auth-service | http://localhost:8081 | http://localhost:8081/actuator/health |
| product-service | http://localhost:8082 | http://localhost:8082/actuator/health |
| cart-service | http://localhost:8083 | http://localhost:8083/actuator/health |
| order-service | http://localhost:8084 | http://localhost:8084/actuator/health |
| payment-service | http://localhost:8085 | http://localhost:8085/actuator/health |

Postgres host ports for direct DB access: `5432` (auth), `5433` (products), `5434` (cart), `5435` (orders), `5436` (payment). Redis is exposed on `localhost:6379` (`docker exec blinkit-redis redis-cli` for inspection).

A complete end-to-end smoke test — signup → login → create products → add to cart → checkout → pay → verify DB persistence — is documented in the [integration validation report](#integration-validation) below.

---

## Service responsibilities & dependency flow

| Service | Owns | Calls |
|---|---|---|
| auth-service | identity, JWT issuance | — |
| product-service | catalogue, inventory authority | — |
| cart-service | per-user cart | → product-service |
| order-service | order orchestration, lifecycle | → cart-service, → product-service |
| payment-service | simulated payment lifecycle | → order-service |

```
auth ──┐
       │ issues JWT (consumed by everyone)
       ▼
   ┌── product ◄──── cart ◄──── order ◄──── payment
   │       ▲                      │            │
   │       └──────────────────────┘            │
   │                                            ▼
   └─────────── (status updates) ────► order-service
```

**Key invariant:** the call graph is a DAG. Lower layers (auth, product) never call up. order-service never calls payment-service. payment-service patches order status — the only "upward" edge — and does it on the user's behalf using the user's JWT.

See [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md) for full one-page summaries per service.

---

## Distributed JWT authentication

### Why one secret, not five

The platform is **stateless**. No service calls back to auth-service to validate every request — they all share the same HMAC-SHA-512 signing key. When a token arrives:

1. The receiving service recomputes the HMAC over the token's header + payload using its local copy of the shared key.
2. If the computed signature matches the one the token carries, the token is authentic — it could only have come from auth-service, because no other party knows the key.

This is the **shared-secret distributed authentication** model. It scales horizontally with zero coordination, but it requires that all instances of all services see the *exact same* secret. Even a single byte of difference breaks signature validation everywhere.

### Algorithm

* **HS512** (HMAC with SHA-512), enforced by auth-service's `JwtTokenProvider`.
* JJWT requires the raw key bytes to be **at least 64 bytes** for HS512. The `.env.example` value is short by design (placeholder); real environments must use `openssl rand -base64 96` or similar.

### Token claims

```json
{
  "sub":     "<email>",
  "userId":  <Long>,
  "email":   "<email>",
  "role":    "USER" | "ADMIN",
  "iat":     <epoch>,
  "exp":     <epoch>
}
```

`userId` is required by cart-service, order-service, and payment-service — they reject tokens without it.

### How services trust each other

```
                  ┌────────────────┐
                  │  auth-service  │ ── issues JWT (HS512, signed with JWT_SECRET)
                  └────────┬───────┘
                           │ Bearer token returned to client
                           ▼
              ┌────────────────────────────────┐
              │       Client / API Gateway     │
              └─┬──────────┬──────────┬────────┘
                │          │          │
                ▼          ▼          ▼
         product-svc   cart-svc   order-svc   payment-svc
         (verifies)    (verifies)  (verifies)   (verifies)
                          │            │            │
                          ▼            ▼            ▼
                       product-svc  cart-svc + product-svc   order-svc
                       (header forwarded — verified again)
```

There is **no service-to-service login**. `WebClient` clients in each service copy the inbound `Authorization` header onto outbound requests via `RequestContextHolder`. Downstream services validate the same token with the same secret.

### Microservice trust model — summary

| Concern | How it is enforced |
|---|---|
| Token authenticity | shared HS512 secret (`JWT_SECRET`) |
| Identity propagation | `Authorization` header forwarded by every `XServiceClient` |
| Token issuance | centralised in auth-service (single issuer) |
| Token validation | local & stateless in every service |
| Secret distribution | env var today; Kubernetes Secret + Azure Key Vault tomorrow |

---

## End-to-end ecommerce workflow

```
 1.  POST /api/auth/signup       → create user (always USER role)
 2.  (admin promotion via SQL)   → optional, for catalogue mutations
 3.  POST /api/auth/login        → JWT (HS512, 24h)
 4.  POST /api/products          → create products (ADMIN)
 5.  GET  /api/products          → browse
 6.  POST /api/cart/add          → cart-service validates with product-service
 7.  GET  /api/cart              → cart with totals
 8.  POST /api/orders/checkout   → order-service orchestrates:
       a. fetch cart (cart-service)
       b. validate items + stock (product-service)
       c. persist order + items (TX)
       d. decrement inventory (product-service)
       e. clear cart (cart-service)
 9.  POST /api/payments/create   → payment-service validates order, persists PENDING payment
10.  POST /api/payments/process  → payment-service simulates settlement,
                                    patches order status (SUCCESS → PAID, FAILED → FAILED)
11.  GET  /api/orders/history    → user's order history with payment-driven status
```

This flow has been integration-validated end-to-end (see [integration validation](#integration-validation)).

---

## Payment orchestration

`payment-service` is intentionally a **two-phase** service: `/create` then `/process`. This separation mirrors how real payment service providers work and keeps the platform simple to extend later.

```
client ──POST /api/payments/create─► payment-service
                                       │
                                       │ GET /api/orders/{id}      ┌──────────────┐
                                       ├──────────────────────────►│ order-service │
                                       │                           │  (validate)   │
                                       │                           └──────────────┘
                                       │
                                       │ persist PENDING payment row
                                       ▼
                                    HTTP 201 (PaymentResponse)

client ──POST /api/payments/process──► payment-service
                                       │
                                       │ simulate outcome
                                       │   • simulateStatus override (SUCCESS/FAILED), OR
                                       │   • PAYMENT_SUCCESS_RATE_PERCENT (default 80%) lottery
                                       │
                                       │ update payments row
                                       │
                                       │ PATCH /api/orders/{id}/status   ┌──────────────┐
                                       ├────────────────────────────────►│ order-service │
                                       │     SUCCESS  → PAID             │   (patch)     │
                                       │     FAILED   → FAILED           └──────────────┘
                                       ▼
                                    HTTP 200 (PaymentResponse)
```

The simulator is configurable via `PAYMENT_SUCCESS_RATE_PERCENT`. There is no real PSP integration today — the path is intentionally pluggable: when a real PSP is needed, replace the simulator inside `PaymentService.processPayment` and leave the controllers, status transitions, and DB schema untouched.

Hardening planned for production:
- **Idempotency** on `/process` (Redis key `payment:idem:{paymentId}` — see [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md)).
- **Outbox + saga** for the order-status patch so partial failures are reconciled, not lost.
- **Webhook receiver** for asynchronous PSP callbacks.

---

## Configuration model

All five services read the same set of environment variables:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | shared HS512 signing key (≥ 64 bytes) |
| `JWT_EXPIRATION` | token lifetime in ms (auth-service only) |
| `POSTGRES_USER` | DB username |
| `POSTGRES_PASSWORD` | DB password |
| `SPRING_DATASOURCE_URL` | overridden per service in Compose |
| `SPRING_PROFILES_ACTIVE` | `dev` for local, blank for prod-like |
| `PRODUCT_SERVICE_BASE_URL` | cart-service / order-service → product-service |
| `CART_SERVICE_BASE_URL` | order-service → cart-service |
| `ORDER_SERVICE_BASE_URL` | payment-service → order-service |
| `PAYMENT_SUCCESS_RATE_PERCENT` | payment-service simulator success rate (default 80) |

Each `application.yml` falls back to a safe HS512-length development default for `JWT_SECRET` so that running a single service from your IDE without an `.env` still works. **Those defaults must not be used in production.**

---

## Running individual services

Each service still has its own `docker-compose.yml` for isolated runs:

```bash
cd auth-service     && docker compose --env-file ../.env up --build
cd product-service  && docker compose --env-file ../.env up --build
cd cart-service     && docker compose --env-file ../.env up --build
cd order-service    && docker compose --env-file ../.env up --build
cd payment-service  && docker compose --env-file ../.env up --build
```

Pointing `--env-file` at the workspace root keeps all services using the same `JWT_SECRET`.

---

## Current platform status

| Area | Status |
|---|---|
| auth-service | ✅ implemented + e2e validated |
| product-service | ✅ implemented + e2e validated |
| cart-service | ✅ implemented + e2e validated |
| order-service | ✅ implemented + e2e validated |
| payment-service | ✅ implemented + integrated in `docker-compose.platform.yml` |
| Full platform single-command bring-up | ✅ all 5 services + 5 Postgres + Redis start with one `docker compose up` |
| Shared HS512 JWT trust model | ✅ verified end-to-end |
| Database-per-service Flyway migrations | ✅ all auto-applied |
| `ApiResponse<T>` envelope across services | ✅ |
| Redis (Phase 1: product-service cache-aside) | ✅ shipped + smoke-tested (hit / miss / invalidate / Redis-down fallback) |
| AI recommendation service | ⚠️ planned |
| API Gateway | ⚠️ planned |
| Redis (Phase 2+: cart, payment, recommendation, gateway) | ⚠️ planned — see [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md) |
| React frontend | ⚠️ planned |
| AKS / Terraform | ⚠️ planned |
| Azure DevOps CI/CD | ⚠️ planned |

---

## Roadmap — production hardening

### Redis

**Phase 1: shipped.** product-service uses Redis as a cache-aside layer over the catalogue. Read endpoints check Redis first, fall through to Postgres on miss, and populate the cache; mutations invalidate the affected key plus all listing/category/search keys via SCAN+UNLINK. Operational logs at INFO level: `CACHE HIT`, `CACHE MISS - loading from DB`, `CACHE INVALIDATED`, `CACHE ERROR on read/write, falling back to DB`. Redis outages **never** produce 5xx — reads degrade to direct-Postgres.

**Phase 2+: planned.** Single Redis instance, multiple logical key prefixes per service:

| Service | Use-case | Strategy |
|---|---|---|
| product-service | hot product / category lookups | read-through, 5–10 min TTL |
| cart-service | per-user cart snapshot | write-through, sliding 30 min |
| payment-service | `/process` idempotency | `SET NX EX 600` lock |
| AI recommendation | per-user recommendations | read-through, 5 min |
| API Gateway | rate limiting | sliding window counters |

Cache failures must always fall through to the source of truth (Postgres / HTTP). Full design in [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md).

### AI recommendation service (planned)

- Stateless service consuming user behaviour (orders, cart adds) and the catalogue indirectly via product / order APIs.
- Caches per-user recommendations under `reco:user:{id}:home` for 5 minutes.
- Initial implementation: heuristic / collaborative filtering. Future: vector embeddings + ANN.
- Authenticates with the same shared `JWT_SECRET`. No new trust model.
- Endpoints: `GET /api/recommendations` (per-user), `GET /api/recommendations/related/{productId}` (anonymous).

### API Gateway (planned)

- Spring Cloud Gateway *or* Azure API Management.
- Single ingress point. Routes:
  - `/api/auth/**` → auth-service
  - `/api/products/**` → product-service
  - `/api/cart/**` → cart-service
  - `/api/orders/**` → order-service
  - `/api/payments/**` → payment-service
  - `/api/recommendations/**` → recommendation-service (when available)
- TLS termination + CORS + Redis-backed rate limiting + circuit breaker.
- Pre-validates JWT to short-circuit unauthenticated traffic; downstream services continue to validate independently (defence in depth).

### Azure Kubernetes Service (AKS, planned)

```
                     Internet
                        │
                        ▼
              ┌──────────────────┐
              │ Azure App Gateway│
              │  (TLS, WAF)      │
              └────────┬─────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   API Gateway    │
              │ (Spring Cloud)   │
              └────────┬─────────┘
                       │
   ┌────────┬─────────┬┴────────┬─────────┬─────────┐
   ▼        ▼         ▼         ▼         ▼         ▼
 auth    product    cart      order    payment    reco
 (Deploy/ClusterIP per service, in 'blinkit' namespace)
   │        │         │         │         │
   ▼        ▼         ▼         ▼         ▼
       Azure Database for PostgreSQL — Flexible Server
   (per-service logical DB; same credentials surface as local)

  Sidecar / shared:
   • Azure Cache for Redis  (Premium, zone-redundant)
   • Azure Key Vault (workload identity + Secrets Store CSI)
   • Azure Monitor + App Insights
   • Container Registry (ACR)
```

- Each service: its own `Deployment` + `ClusterIP Service`, internal DNS `<svc>.<ns>.svc.cluster.local`.
- Shared platform secrets in Kubernetes `Secret` named `blinkit-platform`, mounted via `envFrom`. Backed by Azure Key Vault for rotation.
- PostgreSQL → Azure DB for PostgreSQL — Flexible Server.
- Redis → Azure Cache for Redis.
- Probes wired to `/actuator/health/liveness` and `/readiness`.
- Container images in Azure Container Registry; pulled by AKS via managed identity.

### Azure DevOps CI/CD (planned)

- One pipeline per service: build → test → SAST/SCA → container build → push to ACR.
- Platform pipeline applies Terraform infra and rolls out manifests via Helm: databases → auth → product → cart → order → payment → recommendation → gateway.
- Variable groups linked to Key Vault for build-time configuration.
- Trunk-based with PR validation; release branches per environment.

---

## Integration validation

A complete integration validation has been performed against the running stack. Highlights:

- ✅ All four services healthy on a single `blinkit-net` Docker network.
- ✅ Single `JWT_SECRET` validated across auth / product / cart / order.
- ✅ JWT propagation verified for every cross-service hop.
- ✅ Persistent state verified: orders, order_items, cart cleared, inventory decremented.
- ✅ All failure modes (invalid JWT, expired JWT, empty cart, insufficient stock, missing product, ADMIN-only enforcement, downstream-service unavailable) return correct HTTP statuses + structured `ApiResponse` errors.

When `payment-service` is added to `docker-compose.platform.yml`, the same validation run extends to the payment lifecycle.

---

## Reference

- [PLATFORM_CONTEXT.md](PLATFORM_CONTEXT.md) — master architecture context (read first)
- [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md) — one-page summary per service
- [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) — rules for AI assistants working in this repo
- [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md) — forward-looking Redis design
- Service-level docs:
  - [auth-service/README.md](auth-service/README.md)
  - [product-service/README.md](product-service/README.md)
  - [cart-service/README.md](cart-service/README.md)
  - [order-service/README.md](order-service/README.md)
  - [payment-service/README.md](payment-service/README.md)
