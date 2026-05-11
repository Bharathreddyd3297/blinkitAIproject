# ai-recommendation-service

Internal **AI Recommendation Service** for the Blinkit microservices platform. Read-only intelligence layer that powers four recommendation surfaces — trending, related, frequently-bought-together, and per-user — backed by sentence-transformer embeddings and a Redis cache-aside.

> Read the workspace-root [PLATFORM_CONTEXT.md](../PLATFORM_CONTEXT.md), [AI_ASSISTANT_GUIDE.md](../AI_ASSISTANT_GUIDE.md), and [REDIS_INTEGRATION_PLAN.md](../REDIS_INTEGRATION_PLAN.md) before changing anything cross-service.

---

## 1. Place in the platform

```
                ┌──────────────────────┐
                │   API Gateway (TBD)  │
                └──────────┬───────────┘
                           │
        ┌──────────┬───────┴───────┬──────────────┐
        ▼          ▼               ▼              ▼
   ┌────────┐  ┌──────────┐   ┌──────────┐   ┌────────────────────────┐
   │  auth  │  │ product  │   │ ...other │   │ ai-recommendation      │
   │ :8081  │  │  :8082   │   │ services │   │ service :8090 (this)   │
   └────────┘  └────┬─────┘   └──────────┘   └────────┬───────────────┘
                   ▲                                   │
                   │  GET /api/products[/{id}]         │
                   └───────────────────────────────────┘
                                                       │
                                                       ▼
                                                  ┌─────────┐
                                                  │  Redis  │   (reco:* prefix)
                                                  └─────────┘
```

| Property | Value |
|---|---|
| Service name | `ai-recommendation-service` |
| Port | `8090` |
| Tech | Python 3.12, FastAPI, Uvicorn, redis-py async, httpx, sentence-transformers, scikit-learn |
| Persistence | None (stateless). Catalogue is fetched from `product-service`; recommendations are cached in Redis. |
| Inbound auth | None in Phase-1 (internal layer behind the gateway). Forwards inbound `Authorization: Bearer …` to product-service when present. |
| Outbound | `product-service` (HTTP), `redis` (RESP). Never reads another service's database directly. |

---

## 2. Endpoints

| Method | Path | Phase-1 logic | Cache key | TTL |
|---|---|---|---|---|
| GET | `/api/recommendations/trending` | `0.6 * recency + 0.4 * stock` ranking | `reco:trending` | 5 min |
| GET | `/api/recommendations/related/{productId}` | Cosine similarity over MiniLM embeddings of `name + category + description` | `reco:related:{id}` | 1 hour |
| GET | `/api/recommendations/frequently-bought/{productId}` | Same-category products, ranked by `0.7 * embedding_sim + 0.3 * stock_norm` | `reco:fbt:{id}` | 1 hour |
| GET | `/api/recommendations/user/{userId}` | Stable category-affinity heuristic (deterministic per userId) | `reco:user:{id}` | 5 min |
| GET | `/health`, `/health/liveness`, `/health/readiness` | aggregate / liveness / readiness probes | – | – |
| GET | `/swagger-ui.html`, `/v3/api-docs` | OpenAPI / Swagger UI | – | – |
| GET | `/api/recommendations/_diag/cache-stats` | hit / miss / error counters | – | – |

All responses use the platform-wide `ApiResponse<T>` envelope:

```json
{
  "success": true,
  "message": "Trending products fetched successfully",
  "data": [
    {
      "id": 1,
      "name": "Amul Gold Milk 1L",
      "category": "Dairy",
      "price": 72.0,
      "imageUrl": "https://cdn.example.com/products/amul-gold-1l.jpg",
      "score": 0.91,
      "reason": "High stock and recently listed"
    }
  ],
  "timestamp": "2026-05-08T12:00:00+00:00"
}
```

Errors return the same shape with `success:false` plus a stable `error` code (`PRODUCT_NOT_FOUND`, `PRODUCT_SERVICE_ERROR`, `CATALOG_EMPTY`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`).

See [API_REQUESTS.md](API_REQUESTS.md) for ready-to-paste curl examples.

---

## 3. Architecture

```
app/
├── api/                  thin FastAPI routers (recommendations, health)
├── services/             one service class per feature + a shared engine
│   ├── trending_service.py
│   ├── related_service.py
│   ├── frequently_bought_service.py
│   ├── personalized_service.py
│   ├── recommendation_engine.py     catalogue snapshot + embedding matrix
│   └── embedding_service.py         ST primary + TF-IDF fallback
├── cache/                Redis cache-aside (single touch-point)
│   └── redis_cache.py
├── clients/              HTTP client for product-service (envelope-aware)
│   └── product_client.py
├── models/               internal domain (Product mirrors product-service)
├── schemas/              public DTOs (ApiResponse, RecommendationItem)
├── utils/                cosine similarity helpers
└── core/                 settings, logging, typed exceptions
```

The whole service is async — every Redis read/write and every product-service call goes through async I/O. The only CPU-bound work (embedding the catalogue) is offloaded to a thread via `asyncio.to_thread` so it doesn't block the event loop.

### Embedding strategy

- Primary: `sentence-transformers/all-MiniLM-L6-v2`, 384-dim semantic vectors. Loaded lazily on first use.
- Fallback: scikit-learn `TfidfVectorizer` (1–2 grams, English stopwords). Activates automatically if sentence-transformers fails to import or the model can't download (CI, offline build). Quality degrades gracefully; the service stays UP.
- Embedding text is `name | category | description` — name dominates the short-tail signal in q-commerce search, category grounds taxonomy, description fills out the long tail.
- Vectors are L2-normalised once and reused; cosine similarity is then a single matrix multiply.
- Per-process embedding cache keyed by `product_id → (content_hash, vector)` so we re-embed only when product text actually changes.

### Redis caching strategy

Cache-aside, exactly as `product-service` already does:

```
1. cache.get(key)
2. hit → return cached payload  (log CACHE HIT)
3. miss → compute(), cache.set(key, value, TTL), return  (log CACHE MISS)
4. Redis error → still return computed value, just don't cache  (log CACHE ERROR)
```

| Surface | Key pattern | TTL |
|---|---|---|
| Trending | `reco:trending` | 5 min |
| Related | `reco:related:{productId}` | 1 hour |
| Frequently bought together | `reco:fbt:{productId}` | 1 hour |
| User personalised | `reco:user:{userId}` | 5 min |

**Hard rule** — the AI service only reads/writes its own `reco:*` prefix. Per [REDIS_INTEGRATION_PLAN.md §10](../REDIS_INTEGRATION_PLAN.md), no service ever reads another service's keys.

### Similarity computation

```
similarity = anchor_vector @ catalogue_matrix.T          # both L2-normalised
top_k       = argpartition(-similarity, k)[:k] sorted by score
```

For a catalogue of N products this is O(N · d) where d=384. At N=10⁵ this is still a sub-millisecond operation on a single CPU core; the dominant cost in production will be the model encode pass on miss, not the similarity step.

### Catalogue snapshot

`RecommendationEngine` fetches the catalogue from `product-service` once, embeds it, and caches the (products, matrix) pair in process memory for 10 min. Every per-request hit then reuses the snapshot. Refresh runs under an `asyncio.Lock` so concurrent misses don't fan out into N parallel re-fetches.

### Failure model

| Component | Failure | Behaviour |
|---|---|---|
| Redis | down / slow / serialisation error | Compute path runs, value returned, log `CACHE ERROR`. **Never 5xx.** |
| product-service | 5xx / timeout | Surface as `PRODUCT_SERVICE_ERROR` (502). Catalogue not refreshed; existing in-memory snapshot keeps serving until TTL. |
| product-service | 404 on a related/FBT anchor | `PRODUCT_NOT_FOUND` (404). |
| Catalogue empty | first-time fetch returns 0 | `CATALOG_EMPTY` (503). Readiness probe goes DOWN. |
| Embedding model | can't load | Auto-fall back to TF-IDF backend. Log warning. Service stays UP. |

---

## 4. Running locally

### Prerequisites
- Python 3.12+
- Redis (the platform's `redis` container is fine)
- product-service running at `http://localhost:8082`

### Without Docker

```bash
# 1. Install
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
#   Edit REDIS_HOST=localhost, PRODUCT_SERVICE_BASE_URL=http://localhost:8082

# 3. Run
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

Browse to `http://localhost:8090/swagger-ui.html`.

### Tests

```bash
pytest -q
```

Tests are fully offline: `fakeredis` stands in for Redis, `respx` mocks every product-service HTTP call, and `EMBEDDING_BACKEND=tfidf` is forced so the sentence-transformer download never happens in CI.

### With Docker (standalone)

```bash
# Start the platform's redis + product-service first (from the workspace root):
docker compose -f ../docker-compose.platform.yml up -d redis product-service

# Then start this service:
docker compose -f docker-compose.yml up --build
```

This file joins the existing `blinkit-net` network so it can reach `redis` and `product-service` by DNS.

### With the full platform

When this service is wired into the workspace-root `docker-compose.platform.yml`, a single command brings up the whole stack:

```bash
docker compose -f ../docker-compose.platform.yml up --build
```

The compose snippet to add (left out here per the "do not modify existing services" rule, but mirrored verbatim by the standalone file in this directory) is:

```yaml
ai-recommendation-service:
  build:
    context: ./ai-recommendation-service
    dockerfile: Dockerfile
  image: blinkit/ai-recommendation-service:1.0.0
  container_name: ai-recommendation-service
  restart: unless-stopped
  ports:
    - "8090:8090"
  environment:
    REDIS_HOST: redis
    REDIS_PORT: 6379
    PRODUCT_SERVICE_BASE_URL: http://product-service:8082
    EMBEDDING_BACKEND: ${EMBEDDING_BACKEND:-auto}
  depends_on:
    redis:
      condition: service_healthy
    product-service:
      condition: service_started
  networks:
    - blinkit-net
```

---

## 5. Observability

Every meaningful event emits a structured INFO log. Vocabulary mirrors `product-service` so platform-wide grep patterns work:

```
STARTUP - service=ai-recommendation-service version=1.0.0 port=8090 env=dev
EMBEDDING BACKEND - loading model=sentence-transformers/all-MiniLM-L6-v2
CATALOG SNAPSHOT - refreshing
CATALOG SNAPSHOT - ready products=10 dim=384 backend=sentence_transformers
CACHE MISS - key=reco:related:1
EMBEDDING GENERATED - backend=sentence_transformers items=10/10
SIMILARITY COMPUTED - source=1 catalog=10 topK=5
RECOMMENDATION COMPUTED - key=reco:related:1 elapsed_ms=42.3
CACHE WRITE - key=reco:related:1 ttl=3600s
RECOMMENDATION SERVED - endpoint=related:1 items=5 elapsed_ms=44.0 path=/api/recommendations/related/1
CACHE HIT - key=reco:related:1
CACHE ERROR on read, falling back to compute key=reco:trending reason=Connection refused
```

Cache hit / miss / error counters are exposed at `GET /api/recommendations/_diag/cache-stats` for ad-hoc inspection.

---

## 6. Configuration reference

All configuration is env-driven (see [`.env.example`](.env.example) and [`app/core/config.py`](app/core/config.py)). The most important knobs:

| Variable | Default | Purpose |
|---|---|---|
| `SERVICE_PORT` | `8090` | HTTP listen port |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` | Cache backend |
| `PRODUCT_SERVICE_BASE_URL` | `http://product-service:8082` | Catalogue source |
| `INTERNAL_SERVICE_JWT` | – | Optional fallback bearer when no inbound `Authorization` header |
| `EMBEDDING_BACKEND` | `auto` | `auto`, `sentence_transformers`, or `tfidf` |
| `EMBEDDING_MODEL_NAME` | `sentence-transformers/all-MiniLM-L6-v2` | Hugging Face model id |
| `TTL_*_SECONDS` | 300 / 3600 / 3600 / 300 / 600 | Cache and snapshot TTLs |

---

## 7. Future roadmap

Phase-1 ships the four endpoints above with a deterministic heuristic + embedding-similarity blend. The following are deliberately **out of scope today** but the architecture is designed to absorb them with no breaking change:

### 7.1 Vector database / Redis vector search
Today's similarity is a brute-force matrix-multiply over an in-process matrix — fine for thousands of products. When the catalogue grows past ~10⁵ items, swap in:
- **Redis 8 vector indexes** (HNSW / FLAT) under `reco:vec:*`, OR
- A managed vector DB (Azure AI Search, pgvector on the existing Postgres instance).

The hot path inside `RelatedProductsService.related()` becomes a single `FT.SEARCH` call; no consumer change.

### 7.2 Real co-purchase signal
Replace the same-category heuristic in `frequently_bought_service.py` with a co-occurrence frequency table mined from `blinkit_orders.order_items`. Two consumption shapes are pre-planned:
- Batch nightly job ingesting orders → writing `reco:fbt:{id}` with longer TTL (24h).
- Streaming co-occurrence updates via an event bus (NOT Kafka in Phase-1; introduced when an event-bus task is explicit per [AI_ASSISTANT_GUIDE.md §2](../AI_ASSISTANT_GUIDE.md)).

### 7.3 Per-user behavioural personalisation
The current heuristic is a stable hash of `userId × category` — placeholder until behavioural signal is wired in. Planned upgrades:
- Track viewed / carted / purchased categories per user (event tap on cart-service + order-service).
- Replace `_score_for_user` with a learned ranker (gradient-boosted model, then a two-tower retrieval model).
- Cache invalidation on every cart-add / order-checkout, in addition to TTL.

### 7.4 Event-driven cache invalidation
When product-service mutates a product, today's AI cache only catches up after TTL expiry (≤ 1 hour for related, 5 min for trending). The future bus (REDIS_INTEGRATION_PLAN.md §5 notes) will push `product:updated` events; this service subscribes and invalidates `reco:related:{id}` and the catalogue snapshot.

### 7.5 API Gateway integration
The gateway will:
- Pre-validate JWTs and short-circuit unauthenticated traffic (defence in depth — this service still supports auth-passthrough today).
- Apply per-user / per-IP rate limiting via Redis (`gw:rl:*`).
- Route `/api/recommendations/**` to this service.

### 7.6 AKS deployment
- Deployment + ClusterIP Service per the platform pattern.
- Probes wired to `/health/liveness` and `/health/readiness`.
- Image published to Azure Container Registry; secrets via Key Vault + Secrets Store CSI driver.
- Embedding model pre-baked into the image (already on the FROM-builder layer) so cold-start avoids a Hugging Face download.

---

## 8. Hard rules (do not break)

1. **`reco:` prefix is owned by this service.** No other service writes here, and this service never writes outside it.
2. **Cache failure must never produce 5xx.** Verified by `tests/test_cache.py::TestRedisDownFallback`.
3. **Recommendations are derived; the catalogue source-of-truth is product-service.** No direct DB access, ever.
4. **No OpenAI / LangChain / vector-DB dependencies in Phase-1.** Architecture is ready for them — wiring isn't.
5. **`ApiResponse<T>` envelope is non-negotiable.** Every endpoint, success or failure.
6. **Authentication header propagation.** When an inbound `Authorization` header is present, forward it verbatim to product-service. No service account, no token re-issue.
