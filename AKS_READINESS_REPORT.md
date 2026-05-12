# AKS Readiness Audit

Pre-flight check before lifting the Blinkit platform onto Azure Kubernetes Service. Conducted against the running containerised stack, with one image-size remediation applied.

---

## 1. Verdict

✅ **Cleared for AKS** — all 14 platform containers healthy, every end-to-end flow passes, every database is consistent, every image is below 1.5 GB.

The biggest pre-existing risk (an 8.6 GB AI image) was found and fixed during this audit.

---

## 2. Container state

```
ai-recommendation-service     Up (healthy)
api-gateway                   Up (healthy)
auth-service                  Up (healthy)
blinkit-redis                 Up (healthy)
cart-service                  Up (healthy)
frontend-app                  Up (healthy)
order-service                 Up (healthy)
payment-service               Up (healthy)
postgres-auth                 Up (healthy)
postgres-cart                 Up (healthy)
postgres-orders               Up (healthy)
postgres-payment              Up (healthy)
postgres-products             Up (healthy)
product-service               Up (healthy)
```

14 healthy. No restart loops. No `(unhealthy)` states.

---

## 3. Image audit (final)

| Image | Size | Base | AKS verdict |
|---|---:|---|---|
| `blinkit/frontend-app:1.0.0` | **75.6 MB** | `nginx:1.27-alpine` | ✅ ideal |
| `redis:7-alpine` | 57.8 MB | alpine | ✅ ideal |
| `postgres:16-alpine` / `:17-alpine` | 395 / 399 MB | alpine | ✅ standard |
| `blinkit/cart-service:1.0.0` | 416 MB | `eclipse-temurin:21-jre-alpine` | ✅ |
| `blinkit/order-service:1.0.0` | 416 MB | `eclipse-temurin:21-jre-alpine` | ✅ |
| `blinkit/payment-service:1.0.0` | 416 MB | `eclipse-temurin:21-jre-alpine` | ✅ |
| `blinkit/api-gateway:1.0.0` | 485 MB | `eclipse-temurin:21-jre-alpine` | ✅ |
| `blinkit/auth-service:1.0.0` | 492 MB | `eclipse-temurin:21-jre-alpine` | ✅ |
| `blinkit/product-service:1.0.0` | 526 MB | `eclipse-temurin:21-jre-alpine` | ✅ |
| `blinkit/ai-recommendation-service:1.0.0` | **1.48 GB** | `python:3.12-slim` | ✅ (was 8.63 GB — see §4) |

**Every image now fits inside a single AKS Standard Premium ACR pull window (~30s on a fresh node).** No GPU dependencies. No dev/test packages in production wheels.

---

## 4. Critical fix: AI image bloat 8.63 GB → 1.48 GB

The ai-recommendation-service image was **8.63 GB**. Root cause: `pip install sentence-transformers` pulled the default PyTorch wheel from PyPI, which is the CUDA-enabled build. That dragged in:

| Package | Size | Why it was there |
|---|---:|---|
| `nvidia/*` | 2.7 GB | CUDA runtime libraries (cuBLAS, cuDNN, cuRAND, NVRTC) |
| `torch/` | 1.2 GB | PyTorch CUDA build |
| `triton/` | 641 MB | OpenAI Triton GPU compiler |
| `pandas` | 75 MB | not used anywhere in `app/` |
| `pytest`, `respx`, `fakeredis` | ~50 MB | dev/test deps, never run in production |

The platform runs on CPU only — every byte above was dead weight that would have cost AKS ACR storage and added minutes to every pod pull.

**Fix** (committed in this audit):

1. [ai-recommendation-service/Dockerfile](ai-recommendation-service/Dockerfile) — install the CPU-only PyTorch wheel **first**, from the pytorch.org CPU index, so sentence-transformers finds an already-satisfied torch and skips the CUDA resolution:
   ```dockerfile
   RUN pip install --index-url https://download.pytorch.org/whl/cpu \
         "torch>=2.2,<3.0" \
    && pip install -r requirements.txt
   ```
   Using `--index-url` (not `--extra-index-url`) forces pip away from PyPI's CUDA torch.
2. [ai-recommendation-service/requirements.txt](ai-recommendation-service/requirements.txt) — removed `pandas` (unused) and the four test deps.
3. [ai-recommendation-service/requirements-dev.txt](ai-recommendation-service/requirements-dev.txt) — new file holding the test deps, never installed into the runtime image.
4. Builder stage also strips `__pycache__`, `tests/`, and `test/` directories from the venv.

**Result: 8.63 GB → 1.48 GB. 83% reduction.** Functional surface unchanged; sentence-transformer recommendations + TF-IDF fallback both still work (verified by the e2e run below).

---

## 5. End-to-end validation (through the containerised frontend)

Every call routes `browser → http://localhost (nginx) → http://api-gateway:8080 → service` via Docker DNS:

```
  PASS  X-Content-Type-Options                     # security headers
  PASS  X-Frame-Options
  PASS  Permissions-Policy
  PASS  gzip on /assets
  PASS  signup -> 201                              # auth
  PASS  login -> JWT
  PASS  no-token -> 401 at gateway                 # JWT pre-validate
  PASS  wrong creds -> 401
  PASS  list products -> 8 items                   # catalogue (Redis cache)
  PASS  search-by-name
  PASS  real Unsplash imageUrl
  PASS  missing product -> 404
  PASS  cart/add (id=1 x2) -> 201                  # cart-service ↔ product-service
  PASS  cart/add (id=3 x1) -> 201
  PASS  GET cart -> 2 items, total=172.0
  PASS  checkout -> order #18 (total=172.0, CREATED)   # order-service saga
  PASS  GET order/18 -> 200
  PASS  payment/create -> #13 (PENDING)                # payment-service ↔ order-service
  PASS  payment/process -> SUCCESS
  PASS  order #18 transitioned CREATED -> PAID (payment-svc callback)
  PASS  recs trending                              # AI service
  PASS  recs user=22
  PASS  recs related/1

E2E: 23 PASS, 0 FAIL
```

### Cross-DB persistence audit

| DB | Verified |
|---|---|
| `postgres-auth` | user 22 (AKS Audit, role=USER) inserted |
| `postgres-orders` | order #18 → status `PAID`, total 172.00, 2 order_items (product 1 × 2 = 144.00; product 3 × 1 = 28.00) |
| `postgres-payment` | payment #13 → status `SUCCESS`, transaction_id `TXN-20260512-080752-791711`, linked to order #18 + user 22 |
| `postgres-products` | stock decremented post-checkout (id=1 → 129, id=3 → 292), updated_at advanced — proves the order-service → product-service inventory PATCH (via `INTERNAL_SERVICE_JWT`) worked |
| `postgres-cart` | cart_items for user 22 = 0 — cleared by order-service after successful checkout |
| `blinkit-redis` | live cache keys: `blinkit:products:all:*`, `reco:trending`, `reco:user:22`, `reco:related:{1,6}`, `gw:ratelimit:*` |
| Flyway state | auth=V1, cart=V1, orders=V1, payments=V1, products=V3 (the `V3__Refresh_Product_Images.sql` migration applied) |

---

## 6. Resource footprint (steady state, no traffic)

| Container | Memory | CPU |
|---|---:|---:|
| frontend-app | 10.4 MB | 0.00% |
| auth-service | 317 MB | 0.14% |
| order-service | 392 MB | 0.26% |
| payment-service | 392 MB | 0.17% |
| api-gateway | 392 MB | 0.28% |
| ai-recommendation-service | 362 MB | 0.30% |
| cart-service | 404 MB | 2.6% |
| product-service | 436 MB | 0.25% |
| 5× postgres | 25 – 42 MB each | < 2.5% |
| redis | 10 MB | 2.4% |
| **Total** | **~2.9 GB RSS** | **idle** |

For AKS, conservative pod requests/limits to start with:

| Service | requests.memory | limits.memory | requests.cpu | limits.cpu |
|---|---|---|---|---|
| frontend-app | 32 Mi | 128 Mi | 25 m | 200 m |
| auth-service | 384 Mi | 768 Mi | 100 m | 500 m |
| cart / order / payment | 384 Mi | 768 Mi | 100 m | 500 m |
| product-service | 512 Mi | 1 Gi | 100 m | 500 m |
| api-gateway | 384 Mi | 768 Mi | 100 m | 500 m |
| ai-recommendation-service | 512 Mi | 1.5 Gi | 250 m | 1000 m |
| postgres-* (use Azure DB for PostgreSQL Flexible Server instead) | — | — | — | — |
| redis (use Azure Cache for Redis instead) | — | — | — | — |

(JVM services should also set `JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"` so the heap respects the container cgroup limits — they already do via `JAVA_OPTS` in compose.)

---

## 7. Compose file audit

[docker-compose.platform.yml](docker-compose.platform.yml) parses cleanly (`docker compose config --quiet` exits 0). Highlights of the current state:

| Concern | Status |
|---|---|
| Single shared bridge network `blinkit-net` | ✅ |
| Database-per-service (5 Postgres) | ✅ |
| `depends_on` with `service_healthy` where needed | ✅ |
| Healthchecks on every long-running service | ✅ |
| Env injection via shared `.env` (JWT_SECRET, POSTGRES_USER/PWD, INTERNAL_SERVICE_JWT) | ✅ |
| Restart policy `unless-stopped` on every service | ✅ |
| Named volumes for every Postgres + Redis | ✅ |
| Service-to-service hostnames are Docker DNS (no `localhost` leaking inside the network) | ✅ |
| Gateway is the only public ingress for the React SPA (via the nginx proxy) | ✅ |
| Frontend container reads `${FRONTEND_HOST_PORT:-80}` for host port override | ✅ |

---

## 8. AKS-port lift plan

What changes when this platform moves to AKS:

| Compose primitive | AKS equivalent |
|---|---|
| `services:` | one `Deployment` + `Service` per container (ClusterIP for everything except the gateway / frontend) |
| `blinkit-net` bridge | the cluster Pod network — every Service is reachable by `name.namespace.svc.cluster.local` |
| `postgres-*` containers | **Azure Database for PostgreSQL — Flexible Server** (one logical DB per service, same `JDBC_URL` shape) |
| `redis` container | **Azure Cache for Redis** (Standard or Premium for HA) |
| `.env` | a Kubernetes `Secret` named `blinkit-platform`, mounted via `envFrom`, backed by **Azure Key Vault** + the Secrets Store CSI driver |
| Healthchecks | `livenessProbe` + `readinessProbe` pointing at `/actuator/health/liveness` (Spring) or `/health/live` (FastAPI) or `/` (nginx) |
| Ports | only `frontend-app` (and optionally `api-gateway` for debugging) exposed externally via an `Ingress`. All other ports are ClusterIP-only. |
| Image tags | replace `1.0.0` with `${GIT_SHA}` in the pipeline; push to **Azure Container Registry**; AKS pulls via **managed identity** |
| Storage | the Postgres `volumes:` go away (managed PaaS); only Redis can optionally use a PVC if you go self-hosted |
| TLS | terminate at **Azure App Gateway** or the AKS Ingress; the in-cluster traffic stays HTTP |

---

## 9. Pre-cloud-cutover checklist

- [x] All container images < 1.5 GB
- [x] No CUDA / GPU deps in the AI image
- [x] No node_modules or source in the frontend image
- [x] Multi-stage Dockerfiles across every service
- [x] Non-root user inside every service container
- [x] Healthchecks return false on failure (verified via `docker inspect`)
- [x] End-to-end flow passes through the gateway and through the nginx proxy
- [x] Cross-DB consistency verified after checkout
- [x] Stateless JWT trust model (shared HS512 secret, single issuer, every service validates locally)
- [x] CORS centralised at the api-gateway (`RETAIN_FIRST` dedupe handles downstreams that re-emit Access-Control-* headers)
- [x] AI service is CPU-only and not memory-pinning
- [x] Redis failure paths are non-fatal (cache miss → DB; rate-limit Redis-down → fail-open)
- [x] V3 product-image Flyway migration applied
- [ ] **Real PSP integration** — payment is still simulator-driven. Replace `PaymentService.processPayment` with Stripe/Razorpay before any production cutover.
- [ ] **Strict-Transport-Security + CSP** — currently not emitted from the nginx layer because we're HTTP-only locally. Add at the Azure App Gateway / Ingress with a 1-year HSTS and a CSP allowlisting `fonts.googleapis.com`, `images.unsplash.com`, and the gateway origin.
- [ ] **Payment idempotency** — `payment-service` has no `payment:idem:{paymentId}` Redis lock yet. A duplicate `/process` retry on the same payment row would double-settle. Add the `SET NX EX 600` lock before any real-money flow.
- [ ] **Outbox + saga for the payment→order callback** — currently the order-status patch is a plain HTTP call; a transient failure would leave the order in CREATED while the payment is SUCCESS.
- [ ] **Image scan in CI** — `trivy image blinkit/* --severity HIGH,CRITICAL` should fail the pipeline.
- [ ] **Tag with commit SHA, not `latest`** — every image now hardcoded to `1.0.0`. Switch to `${GIT_SHA}` in the build pipeline.
- [ ] **Renovate / Dependabot** — automate npm / maven / pip / base-image upgrades.
- [ ] **Sentry / OTel** — propagate the existing `X-Request-Id` correlation through to a real telemetry backend.
- [ ] **Stale containers from a prior project** — three `ecommerce-*` containers (exited 7 weeks ago, `ecommerce-backend`, `ecommerce-frontend`, `ecommerce-mysql`) are sitting in `docker ps -a` and unrelated to this platform. Safe to remove manually:
  ```bash
  docker rm ecommerce-backend ecommerce-frontend ecommerce-mysql
  ```
  (I deliberately did not delete these in the audit — they're from a different project and not mine to discard without your sign-off.)

---

## 10. Files changed in this audit

| File | Change |
|---|---|
| [ai-recommendation-service/Dockerfile](ai-recommendation-service/Dockerfile) | Install CPU-only torch from pytorch.org CPU index before sentence-transformers; strip `__pycache__` / `tests` from venv. |
| [ai-recommendation-service/requirements.txt](ai-recommendation-service/requirements.txt) | Removed `pandas` (unused) and the four test packages. |
| [ai-recommendation-service/requirements-dev.txt](ai-recommendation-service/requirements-dev.txt) | New file holding `pytest`, `pytest-asyncio`, `respx`, `fakeredis`. |

No backend Java services, no frontend code, no compose structural changes were needed. The platform was already production-shaped — the audit confirmed it and trimmed the one outlier.
