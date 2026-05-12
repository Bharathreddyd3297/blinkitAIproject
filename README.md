# Blinkit Microservices Platform

A capstone-grade, cloud-native instant-commerce ("Blinkit-style") platform built as **seven independent services** behind a single API gateway, with a React frontend, AI-driven product recommendations, Redis caching, distributed JWT auth, and database-per-service Postgres. Everything runs locally with one `docker compose up`, and is structured for a clean lift onto Azure Kubernetes Service.

> 📚 **For AI assistants and new contributors:** start with [PLATFORM_CONTEXT.md](PLATFORM_CONTEXT.md), [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md), and [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) before scanning the whole tree.

---

## What this application does

Blinkit-clone is a working end-to-end ecommerce platform that lets a shopper:

1. **Sign up** and log in — credentials hashed by auth-service, returned as a stateless HS512 JWT.
2. **Browse a real-time product catalogue** — hot reads served from Redis, miss-paths fall through to Postgres.
3. **See AI-personalised recommendations** — trending products, "related to this", and per-user picks driven by a FastAPI service using sentence-transformer embeddings.
4. **Add items to a per-user cart** — cart-service validates each line against product-service's live stock.
5. **Check out** — order-service runs a transactional saga: pulls the cart → validates stock → persists the order → decrements inventory on product-service using an internal `SERVICE`-role JWT → clears the cart.
6. **Pay** — payment-service runs a two-phase simulator (`/create` → `/process`) and, on settle, patches the order status (`SUCCESS → PAID`, `FAILED → FAILED`) back on order-service.
7. **View order history** — owner-scoped, with payment-driven status.

Everything goes through a single public ingress (api-gateway) that pre-validates the JWT, applies Redis-backed rate limiting, and enforces a uniform CORS policy. Each downstream service still validates the same token independently — defence in depth.

---

## Architecture

```
                    ┌────────────────────────────────────────────┐
                    │   Frontend — React 18 + Vite + Redux       │
                    │   localhost:5173                           │
                    └─────────────────┬──────────────────────────┘
                                      │ HTTPS / HTTP (dev)
                                      ▼
                    ┌────────────────────────────────────────────┐
                    │   API Gateway — Spring Cloud Gateway       │
                    │   localhost:8080                           │
                    │   • JWT pre-validation                     │
                    │   • CORS (origin pinned to frontend)       │
                    │   • Redis-backed rate limiting             │
                    │   • Request id + tracing                   │
                    └─────────────────┬──────────────────────────┘
                                      │ Docker DNS (in-cluster)
   ┌──────────┬──────────┬────────────┼────────────┬──────────┬──────────────┐
   ▼          ▼          ▼            ▼            ▼          ▼              ▼
┌────────┐ ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌─────────┐ ┌──────────────────────┐
│  auth  │ │ product  │ │  cart   │ │   order   │ │ payment │ │ ai-recommendation    │
│  :8081 │ │  :8082   │ │  :8083  │ │   :8084   │ │  :8085  │ │ :8090 (FastAPI)      │
│ Spring │ │ Spring   │ │ Spring  │ │  Spring   │ │ Spring  │ │ Python 3.12          │
└───┬────┘ └────┬─────┘ └────┬────┘ └────┬──────┘ └────┬────┘ └─────────┬────────────┘
    │          │              │            │              │             │
    │          │              │            │              │             │ embeddings
    │          │              │            │              │             ▼
    │          │              │            │              │      ┌──────────────┐
    │          │              │            │              │      │ in-process   │
    │          │              │            │              │      │ vector index │
    │          │              │            │              │      └──────────────┘
    ▼          ▼              ▼            ▼              ▼
┌────────┐ ┌─────────┐  ┌─────────┐  ┌──────────┐   ┌──────────┐
│ PG 5432│ │ PG 5433 │  │ PG 5434 │  │ PG 5435  │   │ PG 5436  │
│ auth   │ │products │  │ cart    │  │ orders   │   │ payments │
└────────┘ └─────────┘  └─────────┘  └──────────┘   └──────────┘

                        ┌─────────────────────────────┐
                        │  Redis 7 — blinkit-redis    │
                        │  • product-service cache    │
                        │  • ai-reco cache            │
                        │  • gateway rate-limit       │
                        └─────────────────────────────┘
```

**One paragraph:** six Spring Boot 3 services + one FastAPI service share one HS512 `JWT_SECRET`, one `ApiResponse<T>` envelope, one Postgres-per-service pattern, and one Redis instance. They talk over HTTP via `WebClient` (or `httpx` for the Python service), propagating the inbound `Authorization: Bearer …` header on every cross-service hop. auth-service signs; everyone else verifies locally. There is no shared database, no callback-to-auth, and no central session store.

**The call graph is a DAG.** Lower layers (auth, product) never call up. payment-service is the only "upward" edge — it patches order status on the user's behalf using the user's own JWT. order-service performs the only privileged downstream call: inventory decrement on product-service, signed with a long-lived `SERVICE`-role JWT.

---

## Workspace layout

```
blinkit-clone/
├── README.md                         ← you are here
├── PLATFORM_CONTEXT.md               master architecture context (read first)
├── SERVICE_SUMMARIES.md              one-page summary per service
├── AI_ASSISTANT_GUIDE.md             rules for AI coding assistants
├── REDIS_INTEGRATION_PLAN.md         per-service caching playbook (Phase 1 shipped)
├── .env.example                      shared env template
├── docker-compose.platform.yml       full stack (13 containers, one command)
│
├── api-gateway/                      Spring Cloud Gateway        (port 8080)
├── auth-service/                     JWT issuer                  (port 8081)
├── product-service/                  catalogue + inventory       (port 8082)
├── cart-service/                     per-user cart               (port 8083)
├── order-service/                    checkout orchestrator       (port 8084)
├── payment-service/                  simulated payments          (port 8085)
├── ai-recommendation-service/        FastAPI + sentence-bert     (port 8090)
└── frontend-app/                     React + Vite + Redux        (dev 5173)
```

Each service has its own `README.md`, `Dockerfile`, `pom.xml` (or `pyproject.toml`), `src/`, and Flyway migrations under `src/main/resources/db/migration/` where applicable.

---

## Quick start

```bash
cp .env.example .env             # populate JWT_SECRET (≥64 bytes), INTERNAL_SERVICE_JWT, etc.
docker compose -f docker-compose.platform.yml up --build -d
cd frontend-app && npm install && npm run dev
```

That brings up **13 containers** (gateway + 6 backend services + 5 Postgres + Redis) on the `blinkit-net` Docker network, plus the Vite dev server on `http://localhost:5173`.

| Surface | URL |
|---|---|
| Frontend (Vite) | http://localhost:5173 |
| API gateway | http://localhost:8080 |
| auth-service | http://localhost:8081 |
| product-service | http://localhost:8082 |
| cart-service | http://localhost:8083 |
| order-service | http://localhost:8084 |
| payment-service | http://localhost:8085 |
| ai-recommendation-service | http://localhost:8090 |

Postgres host ports: `5432` (auth), `5433` (products), `5434` (cart), `5435` (orders), `5436` (payments). Redis on `localhost:6379` — `docker exec blinkit-redis redis-cli` for inspection. Every service exposes `/actuator/health` (Java) or `/health/live` (Python) for probes.

---

## How a request flows through the system

Below is the full life of a single checkout, end to end:

```
1. Browser  →  Gateway          POST /api/auth/login
                                │ Gateway: rate-limit, CORS, public path (no JWT needed)
                                ▼
   Gateway  →  auth-service     POST /api/auth/login
                                │ verify password, sign HS512 JWT (sub=email, userId, role)
                                ▼
                              JWT returned to browser

2. Browser  →  Gateway          GET /api/products?size=20
                                │ Gateway: validate JWT against shared secret
                                ▼
   Gateway  →  product-service  GET /api/products
                                │ product-service revalidates JWT (defence in depth)
                                │ ProductCache.getOrLoad → Redis HIT or DB fallback
                                ▼
                              ApiResponse<Page<Product>> back to browser

3. Browser  →  Gateway          POST /api/cart/add  { productId, quantity }
                                ▼
   Gateway  →  cart-service     POST /api/cart/add
                                │ cart-service forwards JWT to product-service to verify
                                │ product still exists + has stock
                                ▼
   cart-svc →  product-service  GET /api/products/{id}
                                ▲
                                │ price + stock returned
                                ▼
                              cart line item persisted

4. Browser  →  Gateway          POST /api/orders/checkout
                                ▼
   Gateway  →  order-service    POST /api/orders/checkout
                                │ a. fetch cart (cart-service, user JWT)
                                │ b. validate each line (product-service, user JWT)
                                │ c. BEGIN TX: insert order + items
                                │ d. PATCH /api/products/{id}/inventory
                                │    using INTERNAL_SERVICE_JWT (SERVICE role)
                                │ e. clear cart (cart-service)
                                │ f. COMMIT
                                ▼
                              Order { id, status=CREATED, items[], total }

5. Browser  →  Gateway          POST /api/payments/create { orderId, paymentMethod }
                                ▼
   Gateway  →  payment-service  validate order via order-service.getOrderById
                                │ persist PENDING payment row
                                ▼
                              Payment { id, status=PENDING }

6. Browser  →  Gateway          POST /api/payments/process { paymentId }
                                ▼
   Gateway  →  payment-service  settle (simulator: 80% SUCCESS by default)
                                │ payment-service PATCH /api/orders/{id}/status
                                │   SUCCESS → PAID, FAILED → FAILED
                                ▼
                              Payment { status=SUCCESS, transactionId }
                              + Order { status=PAID } on next read
```

---

## Distributed JWT trust model

```
auth-service signs ──► (Bearer JWT) ──► every service verifies locally with the SAME secret
```

* **HS512** (HMAC SHA-512) signing, ≥ 64-byte secret, single `JWT_SECRET` env var injected into every container.
* Claims:
  ```json
  { "sub": "<email>", "userId": <Long>, "email": "<email>", "role": "USER|ADMIN|SERVICE", "iat": …, "exp": … }
  ```
  `userId` is required by cart, order, and payment — they reject tokens that lack it.
* **No service-to-service login.** Each `WebClient` copies the inbound `Authorization` header onto outbound requests via Spring's `RequestContextHolder`. Downstream verifies with the same secret.
* **One privileged exception**: order-service uses a long-lived `SERVICE`-role JWT (env: `INTERNAL_SERVICE_JWT`) when patching product inventory, because the user has no permission to write to the catalogue. product-service's controller allows `hasAnyRole('ADMIN','SERVICE')` for inventory PATCH.

| Concern | How it's enforced |
|---|---|
| Token authenticity | shared HS512 secret |
| Identity propagation | `Authorization` header forwarded by every `XServiceClient` |
| Token issuance | centralised in auth-service |
| Token validation | local + stateless in every service AND at the gateway |
| Service-to-service privileged calls | long-lived SERVICE-role JWT (`INTERNAL_SERVICE_JWT`) |
| Secret distribution | env var locally → Kubernetes Secret + Azure Key Vault in cloud |

---

## API gateway capabilities

[api-gateway/README.md](api-gateway/README.md) covers details. Live capabilities:

* **Single public ingress.** All `/api/**` traffic comes in here. Per-service ports are still reachable for direct dev work but never used by the frontend.
* **Pre-validates JWT** before forwarding. Unauthenticated calls to private paths return the platform's `ApiResponse` error envelope instead of Spring Security's default.
* **Public path allow-list** (`/api/auth/**`, `/actuator/**`, swagger, etc.) declared once in `gateway.security.public-paths`.
* **CORS** — origin pinned to the React dev host, allowed headers explicitly include `Authorization`, `Content-Type`, `Accept`, `X-Client`, `X-Request-Id`. `DedupeResponseHeader=… RETAIN_FIRST` ensures downstream services can't accidentally double-set CORS headers (would otherwise produce `Access-Control-Allow-Origin: http://localhost:5173, *` which browsers reject).
* **Rate limiting** — Redis-backed sliding-window counter, per IP. Redis-down falls open (rate limiter must never break traffic).
* **Routes** — Docker DNS hostnames match compose service keys:
  ```
  /api/auth/**            → auth-service:8081
  /api/products/**        → product-service:8082
  /api/categories/**      → product-service:8082
  /api/cart/**            → cart-service:8083
  /api/orders/**          → order-service:8084
  /api/payments/**        → payment-service:8085
  /api/recommendations/** → ai-recommendation-service:8090
  ```

---

## Service responsibilities

| Service | Stack | Owns | Calls downstream |
|---|---|---|---|
| auth-service | Spring Boot 3, JJWT | Identity, signup/login, JWT issuance | — |
| product-service | Spring Boot 3, Postgres, Redis | Catalogue, inventory authority | — |
| cart-service | Spring Boot 3, Postgres | Per-user cart lines + totals | product-service |
| order-service | Spring Boot 3, Postgres | Checkout saga, order lifecycle | cart-service, product-service |
| payment-service | Spring Boot 3, Postgres | Two-phase simulated payment | order-service |
| ai-recommendation-service | FastAPI, sentence-transformers, Redis | Trending / related / per-user recommendations | product-service (catalogue snapshot), order-service (signal) |
| api-gateway | Spring Cloud Gateway, Redis | Single ingress, JWT pre-validate, CORS, rate-limit | all services |

Per-service docs:

* [auth-service/README.md](auth-service/README.md)
* [product-service/README.md](product-service/README.md)
* [cart-service/README.md](cart-service/README.md)
* [order-service/README.md](order-service/README.md)
* [payment-service/README.md](payment-service/README.md)
* [ai-recommendation-service/README.md](ai-recommendation-service/README.md)
* [api-gateway/README.md](api-gateway/README.md)

---

## AI recommendations (ai-recommendation-service)

A standalone FastAPI service that produces three views:

* `GET /api/recommendations/trending?limit=N` — most-ordered products platform-wide, anonymous.
* `GET /api/recommendations/related/{productId}?limit=N` — nearest neighbours of the queried product in embedding space.
* `GET /api/recommendations/user/{userId}?limit=N` — per-user picks blending the user's order history with the embedding index.

How it works:

1. On startup, the service pulls the catalogue from product-service through its `httpx` client (forwarding the JWT) and computes a sentence-transformer embedding for each `name + category + description`.
2. The embeddings live in an in-process matrix; cosine similarity drives the "related" feed.
3. User-personalised feeds weight categories the user has purchased recently (via order-service) and re-rank.
4. Results are cached in Redis under `reco:trending`, `reco:related:{id}`, `reco:user:{id}` with 1h / 1h / 5m TTLs respectively. Cache failure degrades to a recompute, never to a 5xx.

CORS is owned by the api-gateway; the FastAPI service does **not** set its own CORS headers (this was a real bug — both setting it produced `http://localhost:5173, *` and browsers rejected it).

---

## Payment orchestration

Intentionally **two-phase**, mirroring real PSPs:

```
POST /api/payments/create          POST /api/payments/process
        │                                   │
        ▼                                   ▼
  validate order with                 simulate outcome (80% SUCCESS by default,
  order-service (15s timeout)         configurable via PAYMENT_SUCCESS_RATE_PERCENT;
        │                             or explicit { simulateStatus: "SUCCESS" })
  persist PENDING payment                   │
                                      update payment row → SUCCESS / FAILED
                                      PATCH /api/orders/{id}/status
                                        SUCCESS → PAID
                                        FAILED  → FAILED
```

* The frontend does **order-first**, then `/payments/create` (needs the real numeric orderId), then `/payments/process`. Doing payment first would only work against a mock — `payment-service /create` calls `order-service.getOrderById` to authoritatively verify the order exists and is owned by the JWT subject before issuing a PENDING payment.
* The payment→order callback uses the user's JWT — payment-service does not trust any userId carried in the request body.
* No real PSP today; the simulator is a single function inside `PaymentService.processPayment`. Replacing it with Stripe/Razorpay is a localized change.

Planned hardening:

* **Idempotency** on `/process` via Redis (`payment:idem:{paymentId}` with `SET NX EX 600`) — see [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md).
* **Outbox + saga** for the order-status PATCH so partial failures reconcile instead of getting lost.
* **Webhook receiver** for asynchronous PSP callbacks.

---

## Caching (Redis)

Phase 1 is **shipped and live** in product-service. Phase 2+ is documented in [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md).

| Service | Use case | Strategy | TTL |
|---|---|---|---|
| product-service ✅ | hot product / category / search lookups | read-through cache-aside | 5–10 min |
| ai-recommendation-service ✅ | trending / related / user feeds | read-through | 5 min – 1 h |
| api-gateway ✅ | per-IP sliding window rate limit | counter | per window |
| cart-service ⬜ | per-user cart snapshot | write-through | 30 min sliding |
| payment-service ⬜ | `/process` idempotency | `SET NX EX 600` lock | 10 min |

Operating principles, enforced everywhere:

* **Redis failure is never a 5xx.** Every cache call logs `CACHE ERROR … falling back to DB` and serves from the source of truth.
* **Cache is invalidated synchronously by the writing service** (commit → invalidate). The reverse order would cache stale data on failure.
* **No service reads another service's keys.** HTTP is still the contract — even when both services use the same Redis instance.

---

## Configuration model

A single root `.env` configures every container.

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | shared HS512 signing key (≥ 64 bytes) |
| `JWT_EXPIRATION` | token lifetime in ms (auth-service only) |
| `INTERNAL_SERVICE_JWT` | long-lived SERVICE-role JWT used by order-service → product-service inventory PATCH |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | shared DB credentials |
| `SPRING_DATASOURCE_URL` | overridden per service in Compose |
| `SPRING_PROFILES_ACTIVE` | `dev` locally, blank in prod-like |
| `PRODUCT_SERVICE_URL` | cart, order → product-service |
| `CART_SERVICE_URL` | order → cart-service |
| `ORDER_SERVICE_URL` | payment → order-service |
| `REDIS_HOST` / `REDIS_PORT` | shared Redis instance |
| `PAYMENT_SUCCESS_RATE_PERCENT` | payment-service simulator (default 80) |
| `RATE_LIMIT_RPM` | gateway per-IP requests per minute (default 100) |
| `VITE_API_BASE_URL` | frontend — always the gateway, never a service directly |

Every `application.yml` falls back to a safe HS512-length development default for `JWT_SECRET` so a single service runs from your IDE without an `.env`. **Those defaults must not be used in production.**

---

## Running individual services

Each backend service still has its own `docker-compose.yml` for isolated runs:

```bash
cd auth-service     && docker compose --env-file ../.env up --build
cd product-service  && docker compose --env-file ../.env up --build
cd cart-service     && docker compose --env-file ../.env up --build
cd order-service    && docker compose --env-file ../.env up --build
cd payment-service  && docker compose --env-file ../.env up --build
cd api-gateway      && docker compose --env-file ../.env up --build
```

Pointing `--env-file` at the workspace root keeps every service on the same `JWT_SECRET`.

The frontend runs natively under Vite — no Dockerfile in dev:

```bash
cd frontend-app && npm install && npm run dev
```

---

## Current platform status

| Area | Status |
|---|---|
| auth-service | ✅ implemented + e2e validated |
| product-service | ✅ implemented + e2e validated (+ Redis cache-aside) |
| cart-service | ✅ implemented + e2e validated |
| order-service | ✅ implemented + e2e validated (+ SERVICE-role inventory PATCH) |
| payment-service | ✅ implemented + e2e validated (two-phase, simulator-driven) |
| ai-recommendation-service | ✅ implemented + Redis-cached |
| api-gateway | ✅ implemented (JWT pre-validate, CORS, Redis rate-limit) |
| React frontend | ✅ implemented (auth, catalogue, cart, checkout, payment, history) |
| Full platform single-command bring-up | ✅ 13 containers in one `docker compose up` |
| Shared HS512 JWT trust model | ✅ verified end-to-end across 7 services |
| Database-per-service Flyway migrations | ✅ all auto-applied |
| `ApiResponse<T>` envelope across services | ✅ |
| Redis Phase 1 — product cache, AI cache, gateway rate-limit | ✅ shipped |
| Redis Phase 2+ — cart snapshot, payment idempotency | ⬜ planned |
| AKS / Terraform | ⬜ planned |
| Azure DevOps CI/CD | ⬜ planned |

---

## Roles & admin

Role enum: `USER` (default), `ADMIN`, `SERVICE`.

Today only **product-service** distinguishes admin from user. ADMIN-only endpoints:

| Action | Endpoint |
|---|---|
| Create product | `POST /api/products` |
| Update product | `PUT /api/products/{id}` |
| Adjust inventory | `PATCH /api/products/{id}/inventory` (also allows SERVICE) |
| Delete product | `DELETE /api/products/{id}` |

To exercise admin endpoints locally, promote a user via SQL:

```bash
docker exec postgres-auth psql -U postgres -d blinkit_auth -c \
  "UPDATE users SET role='ADMIN' WHERE email='you@example.com';"
```

Then log out and log back in — role is encoded in the next JWT. The frontend's `AdminPage` is currently a placeholder; the catalog-management UI is not wired yet.

---

## Roadmap — production hardening

### Azure Kubernetes Service (AKS)

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
 (Deployment + ClusterIP per service, blinkit namespace)
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

* Each service: its own `Deployment` + `ClusterIP Service`, internal DNS `<svc>.<ns>.svc.cluster.local`.
* Shared platform secrets in a Kubernetes `Secret` named `blinkit-platform`, mounted via `envFrom`. Backed by Azure Key Vault for rotation.
* PostgreSQL → Azure DB for PostgreSQL — Flexible Server (logical DB per service).
* Redis → Azure Cache for Redis.
* Probes wired to `/actuator/health/liveness` and `/readiness`.
* Container images in Azure Container Registry; pulled by AKS via managed identity.

### Azure DevOps CI/CD

* One pipeline per service: build → test → SAST/SCA → container build → push to ACR.
* Platform pipeline applies Terraform infra and rolls out manifests via Helm: databases → auth → product → cart → order → payment → recommendation → gateway → frontend.
* Variable groups linked to Key Vault for build-time configuration.
* Trunk-based with PR validation; release branches per environment.

---

## End-to-end integration validation

A full sweep against the running stack consistently passes the following:

* All 13 containers healthy on the shared `blinkit-net` Docker network.
* Single `JWT_SECRET` validated across gateway + 6 services.
* JWT propagation verified for every cross-service hop, including the privileged inventory PATCH via `INTERNAL_SERVICE_JWT`.
* Persistent state verified: users created, orders + order_items persisted, payments linked, inventory decremented, cart cleared post-checkout.
* Failure modes return the correct `ApiResponse` envelope: invalid JWT, expired JWT, empty cart, insufficient stock, missing product, ADMIN-only enforcement, downstream-service unavailable.
* CORS preflights pass for every browser-originated header (`Authorization`, `Content-Type`, `Accept`, `X-Client`, `X-Request-Id`).

A reproducible 22-step smoke script lives in conversation history and can be re-run any time the platform is up.

---

## Reference

* [PLATFORM_CONTEXT.md](PLATFORM_CONTEXT.md) — master architecture context
* [SERVICE_SUMMARIES.md](SERVICE_SUMMARIES.md) — one-page summary per service
* [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) — rules for AI assistants working in this repo
* [REDIS_INTEGRATION_PLAN.md](REDIS_INTEGRATION_PLAN.md) — caching design (Phase 1 shipped, Phase 2+ planned)
* Per-service READMEs linked above
