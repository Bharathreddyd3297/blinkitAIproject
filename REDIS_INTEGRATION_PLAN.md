# Redis Integration Plan

> **Phase 1 shipped.** product-service is now wired through a cache-aside layer (`ProductCache`) backed by the `redis` container in `docker-compose.platform.yml`. Hit/miss/invalidation and Redis-down fallback have been smoke-tested end-to-end — see the "Phase 1 — what was actually built" section below. Phase 2 onward (cart, payment, recommendation, gateway) remains forward-looking design; this document is the playbook when those tasks start.

---

## 1. Why Redis

Today every read goes to Postgres, and every cross-service hop is a synchronous HTTP call. As soon as the platform takes real traffic, three problems show up:

1. **Hot product reads.** `GET /api/products/{id}` is called by cart-service on every add, and by order-service on every checkout — each one round-trips to `blinkit_products`. A read-through cache eliminates 90%+ of those.
2. **Cart latency.** Cart pages re-render on every action; reading from Postgres for each one wastes connections.
3. **Idempotency / dedup.** `payment-service /process`, future webhook receivers, and any retried order checkout need a fast, distributed dedup store. Postgres `SELECT … FOR UPDATE` works but is heavyweight.
4. **Rate limiting at the gateway.** When the API Gateway lands, per-IP / per-user limits need a low-latency counter store.

Redis solves all four with one piece of infrastructure.

---

## 2. Per-service usage

| Service | Use-case | Strategy | Default TTL |
|---|---|---|---|
| product-service | Hot product lookups, category lookups | **read-through cache** with explicit invalidation | 10 min |
| cart-service | Per-user cart snapshot | **write-through cache** keyed by `userId` | 30 min, sliding |
| order-service | (none initially) | — | — |
| payment-service | `/process` idempotency, recent payment-by-id | **idempotency keys** + read-through | 15 min |
| AI recommendation | Per-user home recommendations | **read-through** with async refresh | 5 min |
| API Gateway (future) | Rate limiting, login throttling | sliding window counters | per-window |

`order-service` intentionally does not cache writes — orders are auditable financial records and the read pattern is "the user looking at *their* history", which is bounded and infrequent. Add a cache later if metrics demand it.

---

## 3. Caching strategies in detail

### Product caching (product-service)

- **Read path:** `getProductById(id)` first checks `product:byId:{id}`. Miss → DB → populate cache.
- **Category list:** `getProductsByCategory(name, page)` keyed by `product:cat:{slug}:p{page}:s{size}`.
- **Invalidation:** any successful `POST /api/products`, `PUT /api/products/{id}`, `PATCH /api/products/{id}/inventory`, `DELETE /api/products/{id}` evicts:
  - `product:byId:{id}` (specific row)
  - all keys under `product:cat:*` (catalogue listings — wildcard delete via `SCAN` + `UNLINK`).
- **Stampede protection:** use `SET NX EX` lock keys (`product:lock:byId:{id}`) for cache-fill so a hot miss doesn't fan out to N DB calls.

### Cart caching (cart-service)

- **Storage shape:** the entire `CartResponse` JSON serialized as a single string under `cart:user:{userId}`.
- **Read path:** `GET /api/cart` returns the cached snapshot if present; otherwise builds from DB and populates.
- **Invalidation:** every mutating endpoint (`/add`, `/{id}` update, `/clear`, `/{id}` delete) must `UNLINK cart:user:{userId}` after the DB transaction commits. `clear` is also called by order-service post-checkout — same invalidation applies.
- **TTL:** sliding 30 min (`EXPIRE` reset on read). Expiration drives users back to DB; that's fine.

### Payment caching (payment-service)

- **Idempotency:** `payment:idem:{paymentId}` set with `SET NX EX 600` at the start of `/process`. If `NX` fails, return the cached `PaymentResponse` without re-running the simulator. Prevents duplicate settlement on retries.
- **Recent payment lookup:** `payment:byId:{paymentId}` for `GET /api/payments/{id}` (read-through, 15 min TTL). Owner check happens *after* fetch.
- **No history caching:** history is small and per-user; not worth the invalidation tax.

### AI recommendation caching (recommendation-service, planned)

- **Per-user home page:** `reco:user:{userId}:home` — top-N personalized list, 5 min TTL.
- **Related products:** `reco:related:{productId}` — anonymous, 1 hour TTL.
- **Refresh:** lazy on miss; an async refresh job (when behaviour signals are wired in) can pre-warm by pushing keys with longer TTL during off-peak.

### API Gateway rate limiting (planned)

- **Per-IP burst:** `gw:rl:ip:{cidr}:{window}` sliding window with sorted-set timestamps.
- **Per-user request limit:** `gw:rl:user:{userId}:{window}`.
- **Login throttling:** `gw:rl:login:{email}` to slow brute-force.
- Spring Cloud Gateway has a Redis `RequestRateLimiter` filter — use it directly rather than rolling our own.

---

## 4. Key naming convention

```
<service-prefix>:<entity>:<id-or-tuple>[:<sub-key>]
```

Examples:

```
product:byId:42
product:cat:dairy:p0:s20
cart:user:1
payment:idem:99
payment:byId:99
order:byUser:1:recent           # if added later
reco:user:1:home
reco:related:42
gw:rl:user:1:60s
gw:rl:login:admin@blinkit.test
```

**Rules**

- Lowercase, colon-separated, ASCII only.
- The first segment is the **owning service** — only that service writes / invalidates that prefix. Other services do not read another service's keys directly; they call the owning service's HTTP API.
- No PII in keys (no email, no card numbers). Use the `userId` Long.
- No JWTs in keys.

---

## 5. Cache invalidation strategies

Two flavours, used together:

1. **Direct invalidation on write** (product, cart, payment idempotency). Simple, predictable, used wherever a single service controls both the cache and the DB.

2. **TTL fallback** (recommendation, listings). Eventually consistent. Acceptable when the staleness window is small and the cost of a write-through invalidation is high (e.g. recommendation graph spanning many users).

**Cross-service invalidation is intentionally not supported.** product-service does not push events to "evict cart-service caches"; cart-service stores no product data — it always re-reads via product-service HTTP, which itself is cached at the product-service Redis layer.

If event-driven invalidation becomes necessary later (e.g. AI rec ingesting product price changes), introduce it via a dedicated message bus — **not** by sharing Redis keys across services.

---

## 6. TTL recommendations

| Domain | TTL | Reasoning |
|---|---|---|
| Product by id | 10 min | Catalogue rarely changes; price changes are rare and explicitly invalidated. |
| Product category page | 5 min | Listing pages are user-facing; tolerate small staleness. |
| Cart by userId | 30 min sliding | User session timing. Reset on touch. |
| Payment by id | 15 min | Read-after-create scenarios; longer is wasted. |
| Payment idempotency lock | 10 min | Long enough to absorb retries, short enough to release stuck locks. |
| Recommendation per user | 5 min | Personalization should feel "live". |
| Recommendation related product | 1 hour | Slow-moving, anonymous. |
| Rate-limit window | per-window | Drop window-by-window. |

---

## 7. Spring wiring (when implementation starts)

- Add `spring-boot-starter-data-redis` per consuming service.
- Use `RedisTemplate<String, String>` with Jackson serializer for opaque JSON payloads. **Do not** use `JdkSerializationRedisSerializer` — it makes payloads class-coupled and migration-hostile.
- Wrap Redis access in a thin `Cache<...>` interface in each service's `cache/` package; the service layer talks to that interface, not to `RedisTemplate` directly. This keeps the cache integration a one-file fix per service.
- All Redis errors → log + fall through to DB. **Cache failure must never be a hard failure.**
- Connection pooling via Lettuce (the default), single shared `RedisConnectionFactory` per service.

---

## 8. Local & containerized deployment

### Local

Single Redis container in `docker-compose.platform.yml`:

```yaml
  redis:
    image: redis:7-alpine
    container_name: blinkit-redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - blinkit-net
```

Each consuming service gets `SPRING_REDIS_HOST=redis`, `SPRING_REDIS_PORT=6379` injected via env.

### Kubernetes / AKS

- **Production:** Azure Cache for Redis (Standard tier, single shard) provisioned via Terraform. Connection string + auth key projected via `Secret` (sourced from Key Vault via CSI driver).
- **Dev / preview:** `bitnami/redis` Helm chart with persistence disabled is enough.
- **High availability:** Premium tier with zone-redundant replicas when going to production scale; failover is automatic, application code unchanged.

---

## 9. Implementation order

1. ✅ **Redis container** in `docker-compose.platform.yml` — `redis:7-alpine`, AOF persistence, host port 6379, healthcheck via `redis-cli ping`.
2. ✅ **product-service** read-through cache.
3. ⬜ **cart-service** snapshot cache.
4. ⬜ **payment-service** idempotency cache.
5. ⬜ **recommendation-service** when the service itself lands.
6. ⬜ **API Gateway** rate limiting alongside the gateway's first deploy.

Each step ships independently. Cache failures are non-fatal, so the rollout is low risk.

---

## Phase 1 — what was actually built

**Wiring in product-service**

- `pom.xml` — added `spring-boot-starter-data-redis`.
- [`config/RedisConfig.java`](product-service/src/main/java/com/blinkit/productservice/config/RedisConfig.java) — single `RedisTemplate<String, Object>` bean with `StringRedisSerializer` keys + `GenericJackson2JsonRedisSerializer` values (Jackson, default-typing scoped to `com.blinkit.productservice.dto` + `java.util/lang/math/time`, `JavaTimeModule` registered for `LocalDateTime`).
- [`cache/ProductCache.java`](product-service/src/main/java/com/blinkit/productservice/cache/ProductCache.java) — the only Redis touch-point in the service. Exposes:
  - `getOrLoad(key, loader)` — cache-aside read.
  - `invalidate(keys…)` — drop specific keys.
  - `invalidateByPattern(patterns…)` — SCAN + UNLINK for paginated listings.
  - `invalidateAllProductCaches(productId, reason)` — convenience used by every write path.
- `service/impl/ProductServiceImpl.java` — every read goes through `productCache.getOrLoad(...)`; every write (create / update / delete / inventory adjust) calls `productCache.invalidateAllProductCaches(...)`.
- `application.yml` — `spring.data.redis.host`/`port` from `${REDIS_HOST:localhost}` / `${REDIS_PORT:6379}` so dev (no Docker) still works.

**Compose**

```yaml
redis:
  image: redis:7-alpine
  container_name: blinkit-redis
  command: ["redis-server", "--appendonly", "yes"]
  ports: ["6379:6379"]
  volumes: [redis_data:/data]
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
  networks: [blinkit-net]
```

`product-service` now `depends_on: redis (service_healthy)` and reads `REDIS_HOST=redis`, `REDIS_PORT=6379` — Docker DNS, never `localhost`.

**Key schema actually written by Phase 1**

```
blinkit:products:id:{id}
blinkit:products:all:p{page}:s{size}:sort{sort}
blinkit:products:category:{category}:p{page}:s{size}:sort{sort}
blinkit:products:search:cat={cat}:name={name}:p{p}:s{s}:sort{sort}
```

(Pagination is encoded in the key so different pages cache independently.)

**Cache invalidation actually performed by Phase 1**

Every product write triggers:
- `DEL blinkit:products:id:{productId}`
- `SCAN+UNLINK blinkit:products:all*`
- `SCAN+UNLINK blinkit:products:category:*`
- `SCAN+UNLINK blinkit:products:search:*`

This is broader than strictly necessary (a price change for product 7 also evicts the cached "Dairy" listing) but it is correct and predictable — and the hit-rate cost is small because lists are short-TTL anyway.

**Operational logs**

```
CACHE HIT - key=blinkit:products:id:1
CACHE MISS - loading from DB - key=blinkit:products:all:p0:s3:sortid:_ASC
CACHE INVALIDATED - keys=[blinkit:products:id:6] removed=1
CACHE INVALIDATED - pattern=blinkit:products:all* matched=1
CACHE INVALIDATED ALL - productId=6 reason=inventory-adjusted
CACHE ERROR on read, falling back to DB - key=… reason=Redis command timed out
```

**Smoke results**

- ✅ Redis container starts and reports `PONG`.
- ✅ Read paths log MISS on first call, HIT on subsequent.
- ✅ Inventory PATCH logs `CACHE INVALIDATED ALL` and clears listing keys.
- ✅ With `docker stop blinkit-redis` the API still returns 200 — `CACHE ERROR on read, falling back to DB` logged once and the request is served from Postgres.
- ✅ After `docker start blinkit-redis` the cache resumes; AOF preserves entries across restart so existing keys remain HOT.
- ✅ JWT validation unaffected — every request still requires the bearer token.

---

## 10. Hard rules

1. **No service reads another service's keys directly.** The HTTP boundary is still the contract.
2. **No secrets in Redis.** Tokens, passwords, card numbers — never.
3. **Every write to a cached entity invalidates its key in the same atomic logical step** (commit → invalidate). If both can't be made atomic, prefer "write DB, invalidate cache, accept brief staleness" over "invalidate first, write second" (the latter caches stale data on failure).
4. **TTL on every key.** No naked `SET` without `EX`. If you genuinely need a forever key, add a doc comment explaining why.
5. **Treat Redis as a cache, not a database.** Source of truth is always Postgres.
