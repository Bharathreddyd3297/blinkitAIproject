# api-gateway

> Single ingress for all external traffic into the Blinkit microservices platform. Spring Cloud Gateway (reactive / WebFlux). Stateless. Horizontally scalable.

The gateway routes `/api/**` to the correct downstream service over Docker DNS, validates inbound JWTs against the shared HS512 secret, applies a Redis-backed per-IP rate limit, and emits a structured access log per request. Downstream services continue to validate the JWT independently — the gateway is **defense in depth, not the trust boundary**.

For platform-wide context, read [PLATFORM_CONTEXT.md](../PLATFORM_CONTEXT.md), [SERVICE_SUMMARIES.md](../SERVICE_SUMMARIES.md), and [REDIS_INTEGRATION_PLAN.md](../REDIS_INTEGRATION_PLAN.md) first.

---

## 1. Architecture

```
   Browser / mobile (React @ :3000 / :5173)
                  │
                  │ HTTPS  (TLS terminated by AKS Ingress in prod)
                  ▼
   ┌──────────────────────────────────────────────┐
   │              api-gateway :8080               │
   │                                              │
   │  ┌─────────────┐  ┌─────────────┐  ┌───────┐ │
   │  │ CORS        │  │ rate-limit  │  │ JWT   │ │
   │  │ (globalcors)│─►│ (Redis)     │─►│ HS512 │─┐
   │  └─────────────┘  └─────────────┘  └───────┘ │ │
   │                                              │ │
   │  ┌──────────────────────────────────────────┐│ │
   │  │  Spring Cloud Gateway routing filter     ││ │
   │  └──────────────────────────────────────────┘│ │
   └──────────────────────────────────────────────┘ │
                                                    │  Authorization: Bearer …
        ┌──────────┬──────────┬──────────┬──────────┴─────────┬─────────────────┐
        ▼          ▼          ▼          ▼                    ▼                 ▼
   auth-svc   product-svc  cart-svc   order-svc          payment-svc     ai-reco-svc
    :8081       :8082       :8083      :8084               :8085            :8090
```

The gateway never holds business state. The only Redis traffic it generates is the rate-limit counter under the `gw:` key prefix.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Runtime | Java 21 / Spring Boot 3.2.3 |
| Gateway | Spring Cloud Gateway (Spring Cloud 2023.0.3) |
| Auth | JJWT 0.12.3 (HS512) — same library + version as auth-service |
| Rate limit | Reactive Redis Lettuce client, fixed-window counter |
| API docs | springdoc-openapi (WebFlux flavour) |
| Container | Multi-stage Docker; `eclipse-temurin:21-jre-alpine` runtime |

---

## 3. Routing table

| Path prefix | Upstream service | Target (Docker DNS) | Auth |
|---|---|---|---|
| `/api/auth/**` | auth-service | `http://auth-service:8081` | public |
| `/api/products/**` | product-service | `http://product-service:8082` | bearer |
| `/api/categories/**` | product-service | `http://product-service:8082` | bearer |
| `/api/cart/**` | cart-service | `http://cart-service:8083` | bearer |
| `/api/orders/**` | order-service | `http://order-service:8084` | bearer |
| `/api/payments/**` | payment-service | `http://payment-service:8085` | bearer |
| `/api/recommendations/**` | ai-recommendation-service | `http://ai-recommendation-service:8090` | bearer |
| `/actuator/**`, `/health/**`, `/swagger-ui/**`, `/v3/api-docs/**` | gateway itself | — | public |

All routes are declared in [application.yml](src/main/resources/application.yml) under `spring.cloud.gateway.routes`. Each upstream URL is overridable via env (`AUTH_SERVICE_URL`, `PRODUCT_SERVICE_URL`, …) which is what makes this image deployable into any of the platform's environments without rebuild.

---

## 4. JWT validation flow

```
inbound request
      │
      ▼
┌──────────────────────────────────────────┐
│ public path?  ───► yes → forward as-is   │
│  /api/auth/**                            │
│  /actuator/**                            │
│  /swagger-ui/**                          │
│  /v3/api-docs/**                         │
│  /health/**                              │
└──────────────────────────────────────────┘
      │ no
      ▼
parse Authorization: Bearer <token>
      │
      ▼
HS512 verify with JWT_SECRET  ─► invalid ─► 401 INVALID_TOKEN
      │                       ─► expired ─► 401 TOKEN_EXPIRED
      │                       ─► missing ─► 401 MISSING_TOKEN
      ▼
extract userId claim  →  exchange.attributes
      │
      ▼
forward request unchanged
(Authorization header preserved → downstream re-validates)
```

The gateway **does not issue tokens**. Auth-service remains the sole issuer ([PLATFORM_CONTEXT.md §3](../PLATFORM_CONTEXT.md#3-distributed-jwt-authentication)).

Implementation:
- [JwtTokenValidator](src/main/java/com/blinkit/apigateway/security/JwtTokenValidator.java) — same `Keys.hmacShaKeyFor(secret.getBytes())` keying as [auth-service `JwtTokenProvider`](../auth-service/src/main/java/com/blinkit/authservice/security/JwtTokenProvider.java).
- [JwtAuthenticationGlobalFilter](src/main/java/com/blinkit/apigateway/filter/JwtAuthenticationGlobalFilter.java) — runs as a `GlobalFilter`, skips public paths, rejects with the platform `ApiResponse` envelope.
- [PublicRouteRegistry](src/main/java/com/blinkit/apigateway/security/PublicRouteRegistry.java) — single source of truth for whitelisted paths, fed from `application.yml`.

---

## 5. Rate limiting (Redis)

**Algorithm.** Fixed-window per-IP counter. On each request:

```
key   = gw:ratelimit:<client-ip>:<epoch-minute>
count = INCR key
if count == 1: EXPIRE key 60
if count >  100: 429 RATE_LIMIT_EXCEEDED
```

The window key includes `epoch-minute`, so windows naturally roll without any sweep job. Default budget is **100 requests / minute / IP**, override with `RATE_LIMIT_RPM`.

**Fail open.** [RateLimitGlobalFilter](src/main/java/com/blinkit/apigateway/filter/RateLimitGlobalFilter.java) catches every Redis exception and lets the request through. Rate limiting is a **defence-in-depth** feature; it must never be the reason customer traffic fails. The downstream service still enforces its own auth checks, so the worst case during a Redis outage is "limit not enforced", not "data leaks".

**Health and docs paths** (`/actuator/**`, `/health/**`, `/swagger-ui/**`, `/v3/api-docs/**`) skip the limit so Kubernetes probe storms can't trip it.

**Client IP.** Resolved by [ClientIpResolver](src/main/java/com/blinkit/apigateway/util/ClientIpResolver.java) in this priority order: leftmost `X-Forwarded-For` → `X-Real-IP` → direct remote address → `unknown`. This is what AKS / Application Gateway / Azure Front Door set in front of the gateway.

**Key namespace.** `gw:` per the platform Redis convention ([REDIS_INTEGRATION_PLAN.md §4](../REDIS_INTEGRATION_PLAN.md#4-key-naming-convention)). No other service reads or writes this prefix.

---

## 6. CORS

Configured globally in [application.yml](src/main/resources/application.yml) under `spring.cloud.gateway.globalcors`:

| Setting | Value |
|---|---|
| Allowed origins | `http://localhost:3000`, `http://localhost:5173` |
| Allowed methods | `GET, POST, PUT, PATCH, DELETE, OPTIONS` |
| Allowed headers | `Authorization`, `Content-Type` |
| Allow credentials | `true` |
| Preflight cache | 1 hour |

Add production frontend origins to the `allowedOrigins` list when the React app is deployed to AKS. CORS is the only place a hostname change is needed — the rest of the gateway is origin-agnostic.

---

## 7. Request logging

Every request emits a single structured log line on completion:

```
REQUEST - method=GET path=/api/products status=200 duration=35ms user=42
REQUEST - method=POST path=/api/auth/login status=200 duration=12ms
REQUEST - method=GET path=/api/orders status=401 duration=2ms
```

`user=<userId>` is included only when the JWT filter has populated it on the exchange. Public paths therefore log without it, which is the right behaviour for unauthenticated routes like `/api/auth/login`.

Implementation: [RequestLoggingGlobalFilter](src/main/java/com/blinkit/apigateway/filter/RequestLoggingGlobalFilter.java) (order `-100`, runs first → response hook fires last).

---

## 8. Error envelope

Every gateway-generated error returns the platform-wide [`ApiResponse`](src/main/java/com/blinkit/apigateway/exception/ApiResponse.java) shape:

```json
{
  "success": false,
  "message": "Authentication token has expired",
  "error": "TOKEN_EXPIRED",
  "status": 401,
  "timestamp": "2026-05-09T10:00:00"
}
```

| Status | `error` code | When |
|---|---|---|
| 401 | `MISSING_TOKEN` | No `Authorization: Bearer …` header on a protected route |
| 401 | `INVALID_TOKEN` | Token signature / format invalid |
| 401 | `TOKEN_EXPIRED` | `exp` in the past |
| 403 | `FORBIDDEN` | reserved for future role-based gateway checks |
| 404 | `ROUTE_NOT_FOUND` | No matching route predicate |
| 429 | `RATE_LIMIT_EXCEEDED` | Per-IP budget exhausted |
| 502 | `BAD_GATEWAY` | Downstream returned an unhandled error |
| 503 | `SERVICE_UNAVAILABLE` | TCP connect / unknown host |
| 504 | `GATEWAY_TIMEOUT` | Downstream did not respond in time |
| 500 | `INTERNAL_SERVER_ERROR` | Anything else |

Successful proxied responses are streamed straight through and **not** rewrapped — downstream services already produce the same envelope.

Implementation: [GatewayExceptionHandler](src/main/java/com/blinkit/apigateway/exception/GatewayExceptionHandler.java) (custom `AbstractErrorWebExceptionHandler`, order `-2`, beats Spring's default `-1`).

---

## 9. Observability

| Endpoint | Use |
|---|---|
| `GET /actuator/health` | Aggregate liveness + readiness |
| `GET /actuator/health/liveness` | AKS livenessProbe target |
| `GET /actuator/health/readiness` | AKS readinessProbe target |
| `GET /actuator/gateway/routes` | Operational view of registered routes |
| `GET /actuator/info` | Build metadata |

Redis health is intentionally **excluded** from the aggregate (`management.health.redis.enabled=false`) so a Redis blip cannot remove the gateway from rotation. Rate limiting fails open; the gateway is still healthy.

---

## 10. Configuration reference

| Env var | Default | Used for |
|---|---|---|
| `JWT_SECRET` | dev fallback | HS512 verification key. **Must match every other service.** |
| `REDIS_HOST` | `localhost` | Rate-limit counter store |
| `REDIS_PORT` | `6379` | Rate-limit counter store |
| `RATE_LIMIT_RPM` | `100` | Per-IP requests / minute |
| `AUTH_SERVICE_URL` | `http://auth-service:8081` | Route target |
| `PRODUCT_SERVICE_URL` | `http://product-service:8082` | Route target |
| `CART_SERVICE_URL` | `http://cart-service:8083` | Route target |
| `ORDER_SERVICE_URL` | `http://order-service:8084` | Route target |
| `PAYMENT_SERVICE_URL` | `http://payment-service:8085` | Route target |
| `AI_RECOMMENDATION_SERVICE_URL` | `http://ai-recommendation-service:8090` | Route target |
| `JAVA_OPTS` | (none) | JVM tuning passthrough |

`.env.example` is the template; copy to `.env` and fill in real values. The actual `.env` is gitignored.

---

## 11. Running locally

### Option A — gateway only, against an already-running platform

```bash
cp .env.example .env
docker compose up --build
```

This boots `redis` + `api-gateway` only. If you have downstream services running on host ports `8081–8085`, set the `*_SERVICE_URL` env vars to `http://host.docker.internal:8081` etc.

### Option B — full platform (recommended)

From the **workspace root**:

```bash
cp .env.example .env
docker compose -f docker-compose.platform.yml up --build
```

This brings up every service plus the gateway on port `8080`. See the platform compose snippet in §12 below.

### Health check

```bash
curl http://localhost:8080/actuator/health
```

### Login → call protected route

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@blinkit.test","password":"adminpass"}' \
  | jq -r .data.accessToken)

curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/products
```

---

## 12. Platform compose integration

Append the following service block to [`docker-compose.platform.yml`](../docker-compose.platform.yml):

```yaml
  api-gateway:
    build:
      context: ./api-gateway
      dockerfile: Dockerfile
    image: blinkit/api-gateway:1.0.0
    container_name: api-gateway
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      JWT_SECRET: ${JWT_SECRET}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      RATE_LIMIT_RPM: ${RATE_LIMIT_RPM:-100}
      AUTH_SERVICE_URL: http://auth-service:8081
      PRODUCT_SERVICE_URL: http://product-service:8082
      CART_SERVICE_URL: http://cart-service:8083
      ORDER_SERVICE_URL: http://order-service:8084
      PAYMENT_SERVICE_URL: http://payment-service:8085
      AI_RECOMMENDATION_SERVICE_URL: http://ai-recommendation-service:8090
      JAVA_OPTS: "-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - blinkit-net
```

`auth-service`, `product-service`, etc. are **not** declared as `depends_on` here intentionally: the gateway must come up even if a downstream service is briefly unavailable, returning a clean 503 envelope rather than blocking startup.

---

## 13. Validation checklist

| # | Test | Expected |
|---|---|---|
| 1 | `curl http://localhost:8080/actuator/health` | `200 {"status":"UP"}` |
| 2 | `curl http://localhost:8080/api/products` (no token) | `401 INVALID_TOKEN` envelope |
| 3 | `POST /api/auth/login` (valid creds) via gateway | `200` + `accessToken` |
| 4 | `GET /api/products` with that token | `200` proxied list |
| 5 | `GET /api/products` with a tampered token | `401 INVALID_TOKEN` |
| 6 | `GET /api/products` with an expired token | `401 TOKEN_EXPIRED` |
| 7 | `GET /api/recommendations` with a valid token (service offline) | `503 SERVICE_UNAVAILABLE` envelope |
| 8 | 101 requests in <60s from a single IP | Last few return `429 RATE_LIMIT_EXCEEDED` |
| 9 | `docker stop blinkit-redis` then re-run #8 | All requests `200` (fail-open log line emitted) |
| 10 | Preflight `OPTIONS /api/products` from `Origin: http://localhost:5173` | `200` with `Access-Control-Allow-*` headers |
| 11 | Preflight from a non-allowed origin | CORS blocks at the browser; gateway does not 500 |
| 12 | `GET /api/orders` with an admin's token (forwarded to order-service) | `200` proxied — JWT round-trips end-to-end |

A successful run of #1, #2, #4, #8, #9 is the smoke gate. The rest go in CI once the platform pipeline lands.

---

## 14. Forward-looking roadmap

The gateway is intentionally minimal today — its job is "single ingress + JWT + rate limit + CORS". Each item below is a **future** task; the current code is structured so they can land without invasive refactoring.

| Future capability | What the gateway needs to do | Notes |
|---|---|---|
| **AKS Ingress** | Be the only `Service` with `LoadBalancer` exposure; everything else stays `ClusterIP`. | The Spring Cloud Gateway routes already use Docker DNS hostnames identical to Kubernetes service names — no code change. |
| **Horizontal scaling** | Run N replicas behind an Azure Application Gateway / Front Door. | The gateway is fully stateless. Rate-limit state lives in Redis, so scaling out doesn't shard the limit. |
| **Blue-green deploys** | Two gateway Deployments behind a label-switching Service. | No coupling between the gateway and any individual replica's state. |
| **Distributed rate limiting** | Already in place via Redis. | Sliding window via sorted sets is the next refinement; the current fixed-window counter is intentionally simple. |
| **Swagger aggregation** | Pull `/v3/api-docs` from each downstream service and stitch into a single Swagger UI. | The springdoc dependency is already present; aggregation is a single config block away. |
| **Circuit breakers** | Wrap each route with a Resilience4j `CircuitBreaker` filter. | Spring Cloud Gateway has a first-class `CircuitBreaker` filter factory; add per-route. |
| **Retry policies** | `RetryGatewayFilterFactory` per route for idempotent reads. | Add cautiously — retrying POSTs without idempotency keys is unsafe; payment-service `/process` is the canonical example. |
| **WAF integration** | Sit behind Azure WAF / Front Door. | TLS terminates at WAF; `X-Forwarded-For` propagation is already honoured by [ClientIpResolver](src/main/java/com/blinkit/apigateway/util/ClientIpResolver.java). |
| **mTLS to downstream** | Switch the gateway's `WebClient` to use AKS-issued client certificates. | Service-mesh territory; out of scope until a mesh lands. |

---

## 15. Constraints honoured

This service deliberately does **not**:

- Issue JWTs (auth-service stays the sole issuer).
- Read or write any database — it is stateless.
- Cache user data — only the Redis counter under `gw:`.
- Introduce service discovery (Eureka, Consul) — Docker DNS / K8s DNS is enough.
- Introduce Kafka or any message bus.
- Introduce Istio, Linkerd, or Kubernetes ingress controller config — those land later, and the gateway is structured to coexist with them rather than be replaced.
- Modify any existing service. Every behaviour described in [SERVICE_SUMMARIES.md](../SERVICE_SUMMARIES.md) is preserved end-to-end.
