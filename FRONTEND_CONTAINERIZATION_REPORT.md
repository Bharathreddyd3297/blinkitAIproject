# Frontend Containerization Report

Captures the work done to lift the Blinkit premium React frontend from a host-bound Vite dev server into a fully containerised, production-style nginx runtime integrated into the existing Docker platform.

**Scope was preserved.** No architectural rewrites. No simplifications. No animations removed. The 3D layer, Framer Motion stack, Redux store, route-splitting, lazy loading, and Vite build pipeline are all untouched. What changed is **how the built artefact is shipped and served**.

---

## 1. Docker architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │  HTTP same-origin: http://localhost
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ frontend-app  (nginx:1.27-alpine, multi-stage build)             │
│                                                                  │
│   /                      → SPA shell  (Cache-Control: no-store)  │
│   /products/:slug, ...   → SPA fallback to /index.html           │
│   /assets/*              → static, gz, immutable max-age=31536000│
│   /api/**                → proxy_pass http://api-gateway:8080    │
│   /actuator/**           → proxy_pass http://api-gateway:8080    │
│                                                                  │
│   Security headers:                                              │
│     X-Content-Type-Options: nosniff                              │
│     X-Frame-Options: DENY                                        │
│     Referrer-Policy: strict-origin-when-cross-origin             │
│     Permissions-Policy: geolocation=(), microphone=(), camera=() │
│     X-XSS-Protection: 0                                          │
│   server_tokens off                                              │
└────────────────────────────────┬─────────────────────────────────┘
                                 │  Docker bridge network: blinkit-net
                                 ▼
                       ┌──────────────────────┐
                       │ api-gateway :8080    │  JWT pre-validate
                       └──────────┬───────────┘  CORS, rate-limit
                                  │
   ┌──────────┬───────────┬───────┴────────┬───────────────┬─────────────────────┐
   ▼          ▼           ▼                ▼               ▼                     ▼
 auth     product       cart           order           payment           ai-recommendation
 :8081    :8082         :8083          :8084           :8085             :8090 (FastAPI)
   │        │             │              │                │                     │
   ▼        ▼             ▼              ▼                ▼                     ▼
 PG:5432  PG:5433       PG:5434        PG:5435          PG:5436             (consumes Redis)
                                                                                ▲
                                                                                │
                                                              ┌─────────────────┴───────┐
                                                              │   Redis :6379 (shared)  │
                                                              └─────────────────────────┘
```

**14 containers, one `docker compose up`.** Browser sees a single origin (`http://localhost`). No CORS preflights. Gateway port is still exposed for direct curl/debugging but the SPA never uses it.

---

## 2. Nginx configuration

Lives at [`frontend-app/deploy/nginx.conf`](frontend-app/deploy/nginx.conf), mounted into the runtime image as `/etc/nginx/conf.d/default.conf`. Highlights:

| Concern | Implementation | Why |
|---|---|---|
| Upstream | `upstream api_gateway_upstream { server api-gateway:8080; keepalive 32; }` | Single declaration; swap to a Kubernetes Service DNS name when moving to AKS without touching any location blocks. |
| SPA shell | `location = /` and `location = /index.html` → `Cache-Control: no-store, must-revalidate` | The HTML entry must never be cached or every deploy would pin users on stale bundles. |
| Hashed assets | `location /assets/ { expires 1y; add_header Cache-Control "public, max-age=31536000, immutable"; }` | Vite hashes filenames; the contents at a given URL never change, so we can cache forever. |
| Missing asset = 404, not HTML | `try_files $uri =404;` inside `/assets/` | Otherwise a missing `/assets/foo.js` would SPA-fallback to `index.html`, the browser would parse HTML as JS, and the page would white-screen. |
| SPA fallback | `location / { try_files $uri $uri/ /index.html; }` | React-router routes (`/products/:slug`, `/orders/:id`, …) must hit the SPA. |
| /api proxy | `location /api/ { proxy_pass http://api_gateway_upstream; … }` | Same-origin removes CORS. Bearer token, `X-Real-IP`, `X-Forwarded-*` all preserved. `proxy_buffering off` for streaming-friendly latency. |
| Read timeout | `proxy_read_timeout 60s` | AI recommendation cold-start can take ~10s while the sentence-transformer embeddings warm. |
| gzip | `gzip on; gzip_vary on; gzip_min_length 1024; gzip_types text/* application/javascript application/json application/wasm image/svg+xml font/*` | One-time wins on every fresh load; `Vary: Accept-Encoding` keeps caches sane. |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection: 0`, `server_tokens off` | Repeated in each `location =` block because nginx's `add_header` is non-cumulative across blocks (a nested `add_header` *replaces* the server-level set). |

---

## 3. Compose integration

Added a new service to [`docker-compose.platform.yml`](docker-compose.platform.yml):

```yaml
frontend-app:
  build:
    context: ./frontend-app
    dockerfile: Dockerfile
    args:
      VITE_API_BASE_URL: ""            # ← empty → axios uses relative URLs → nginx proxies /api/**
      VITE_API_TIMEOUT: "15000"
      VITE_AUTH_STORAGE_KEY: blinkit.auth
      VITE_APP_NAME: Blinkit
      VITE_APP_VERSION: 0.1.0
      VITE_APP_ENV: production
      VITE_ENABLE_3D: "true"
      VITE_ENABLE_PARTICLES: "true"
      VITE_ENABLE_DEVTOOLS: "false"
  image: blinkit/frontend-app:1.0.0
  container_name: frontend-app
  restart: unless-stopped
  ports:
    - "${FRONTEND_HOST_PORT:-80}:80"
  depends_on:
    api-gateway:
      condition: service_started
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost/ 2>/dev/null | grep -q '<title>Blinkit' || exit 1"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 15s
  networks:
    - blinkit-net
```

**Notes**:

- `FRONTEND_HOST_PORT` env override lets you move off port 80 if it's already taken on the host (e.g. `FRONTEND_HOST_PORT=8088` → SPA at `http://localhost:8088`).
- `depends_on: api-gateway` ensures the first API call after `compose up` doesn't 502 (nginx would serve the SPA either way; this just avoids the first-API-call race).
- Same `blinkit-net` bridge network as every other service — that's how nginx resolves `api-gateway` via Docker DNS.

---

## 4. Healthcheck validation

```
$ docker inspect -f '{{.State.Health.Status}}' frontend-app
healthy
```

The healthcheck calls `wget -qO- http://localhost/ | grep -q '<title>Blinkit'`. It only passes if **both** nginx is binding port 80 AND the served content is the actual SPA shell (not a 502 / 50x page).

First probe runs 15s after start; subsequent probes every 30s, 5s timeout, 3 retries before unhealthy. All 14 containers report `(healthy)` in `docker ps`.

---

## 5. Container startup commands

```bash
# Full platform from scratch (one command)
docker compose -f docker-compose.platform.yml up --build -d

# Frontend only (after a code change)
docker compose -f docker-compose.platform.yml up -d --build frontend-app

# Stop everything
docker compose -f docker-compose.platform.yml down

# Stop frontend only (backend keeps running)
docker compose -f docker-compose.platform.yml stop frontend-app

# Inspect frontend health
docker inspect -f '{{.State.Health.Status}}' frontend-app
docker logs -f frontend-app

# Verify the runtime image is clean (no node_modules, no source)
docker exec frontend-app ls /usr/share/nginx/html
docker exec frontend-app ls /app          # → 'No such file or directory'
docker exec frontend-app find / -name ".env*" 2>/dev/null  # → empty
```

---

## 6. Final runtime URLs

| Surface | URL | Source |
|---|---|---|
| **Frontend (containerised, production-style)** | http://localhost | nginx :80 in the `frontend-app` container |
| Frontend (dev server, optional) | http://localhost:5173 | `npm run dev` — coexists fine with the container |
| API Gateway | http://localhost:8080 | direct port exposure for curl/debugging (the browser never uses this in containerised mode) |
| auth-service | http://localhost:8081 | direct port |
| product-service | http://localhost:8082 | direct port |
| cart-service | http://localhost:8083 | direct port |
| order-service | http://localhost:8084 | direct port |
| payment-service | http://localhost:8085 | direct port |
| ai-recommendation-service | http://localhost:8090 | direct port |
| Postgres (auth/products/cart/orders/payments) | 5432 / 5433 / 5434 / 5435 / 5436 | direct port |
| Redis | localhost:6379 | direct port |

---

## 7. End-to-end validation results

A 15-step smoke run **through the containerised frontend** (`http://localhost`, all calls flow `browser → nginx → api-gateway → service`):

```
  PASS  X-Content-Type-Options
  PASS  X-Frame-Options
  PASS  Referrer-Policy
  PASS  Permissions-Policy
  PASS  gzip on /assets/*.js
  PASS  immutable cache-control on /assets/*
  PASS  auth (signup+login via /api proxy)
  PASS  products list
  PASS  cart get (2 items)
  PASS  checkout -> order #16
  PASS  payment create -> #11
  PASS  payment process -> SUCCESS
  PASS  order 16 transitioned to PAID
  PASS  recs trending
  PASS  recs personalised user=20

============================================================
RESULT: 15 PASS, 0 FAIL  (frontend container = http://localhost)
============================================================
```

Additional structural checks:

| Check | Result |
|---|---|
| `GET / returns SPA shell` | ✅ `<title>Blinkit` present, 3 KB pre-hydration HTML |
| `GET /products/anything-deep` SPA fallback | ✅ 200, returns index.html for client-router routes |
| `GET /assets/missing.js` | ✅ 404 (NOT SPA-fallback — protects browser from parsing HTML as JS) |
| Bearer token passthrough | ✅ verified via successful authed `/api/orders/checkout` |
| OPTIONS preflight | ✅ Not required — same-origin removes CORS entirely |
| Gateway DNS from container | ✅ `wget http://api-gateway:8080/actuator/health` from inside `frontend-app` returns 200 |
| Cross-service state | ✅ Order #16 saved in `postgres-orders`, payment #11 saved in `postgres-payment`, stock decremented in `postgres-products`, order auto-transitioned `CREATED → PAID` via payment-service callback |
| Inventory SERVICE JWT | ✅ Order-service still uses `INTERNAL_SERVICE_JWT` for the privileged PATCH (unchanged) |

---

## 8. Image hygiene

```
$ docker images blinkit/frontend-app:1.0.0
blinkit/frontend-app:1.0.0  size=75.6MB

$ docker exec frontend-app ls /usr/share/nginx/html
50x.html
assets
favicon.svg
index.html

$ docker exec frontend-app ls /app
ls: cannot access '/app': No such file or directory     # ← no source

$ docker exec frontend-app find / -name "node_modules" 2>/dev/null
                                                         # ← empty: no node_modules

$ docker exec frontend-app find / -name ".env*" 2>/dev/null
                                                         # ← empty: no env files
```

- **75.6 MB** total (nginx:alpine base ~13 MB + Three.js vendor chunk ~820 KB + the rest of the static assets).
- Zero source files in the runtime image.
- Zero node_modules in the runtime image.
- Zero `.env` files baked in.
- `.dockerignore` excludes `node_modules/`, `dist/`, `.env`, `.env.local`, `.git/`, IDE files, logs, tsbuildinfo, and the Dockerfile itself from the build context.

---

## 9. Known issues / non-blockers

| Item | Severity | Note |
|---|---|---|
| Two `Cache-Control` headers on `/assets/*` (one from nginx `expires 1y`, one from explicit `add_header`) | cosmetic | Both say the same thing; browsers respect the most explicit (`immutable`). Could clean up by removing the `expires` directive and keeping only the explicit header. |
| `react-vendor` and `three-vendor` deprecation warnings during `npm install` (peer deps) | low | Pre-existing in the dev workflow too. Not introduced by containerization. |
| Order checkout occasionally logs `Inventory reduction failed … TimeoutException` (5s) on cold start | low | Mitigated earlier in this session by bumping order-service inventory timeout from 5s → 10s. The order still saves; inventory is reconciled best-effort. |
| Vite dev server CORS still expects `:5173` and `:3000` at the gateway | by design | The gateway keeps allowing those origins so `npm run dev` continues to work alongside the containerized frontend. |
| Frontend container does NOT mock the backend — it requires the gateway to be up | by design | Mock-fallback layer (`utils/mock.ts`) only triggers on `status === 0` (network failure). In a real outage the SPA degrades; otherwise real errors surface as `ApiError`s. |
| **Build-time inlined config**: `VITE_API_BASE_URL` is baked at build time | by design | Standard for SPAs. To redeploy to a different gateway URL (e.g. AKS behind Azure App Gateway), rebuild with `--build-arg VITE_API_BASE_URL=…`. A runtime config shim (`/runtime-config.js`) is an option for the future. |

None of these block production readiness.

---

## 10. Production readiness notes

**What's production-ready today:**

- Single-command bring-up of all 14 containers.
- Image is multi-stage, minimal, deterministic (`npm ci`), and pinned (`nginx:1.27-alpine`, `node:20-alpine`).
- Healthcheck verifies the served content, not just port binding.
- Security headers on every response.
- gzip + immutable hashed assets for ideal cache behaviour.
- Bearer token passthrough preserves the platform's stateless JWT model.
- Same-origin design removes the entire CORS class of bugs.
- Same image works for AKS by overriding `VITE_API_BASE_URL` at build time and pointing Azure App Gateway / ACR at it.

**Recommended hardening before public deploy:**

1. **TLS termination at the edge** — Azure App Gateway, AWS ALB, or a Caddy/Traefik sidecar in front of the nginx container. Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` at that layer (we don't set it on the nginx container because it's HTTP-only locally).
2. **Content-Security-Policy** — currently not emitted. Add a strict CSP at the edge with explicit allowlists for `fonts.googleapis.com`, `fonts.gstatic.com`, `images.unsplash.com`, and the gateway origin.
3. **Image scanning** — `trivy image blinkit/frontend-app:1.0.0` in CI; fail on HIGH/CRITICAL.
4. **Tag with commit SHA** — replace `1.0.0` with `${GIT_SHA}` in the pipeline; never push `latest`.
5. **Renovate / Dependabot** — automate npm + base-image upgrades.
6. **Lighthouse-CI** — gate the build on Performance ≥ 90, A11y ≥ 95.
7. **Playwright golden checkout E2E** — currently validated by curl; promote to a headless-browser flow.
8. **Sentry / OTel** — wire the `X-Request-Id` from the request interceptor into a frontend telemetry pipeline.
9. **Runtime config shim** — if multi-env image reuse becomes a priority (one image → many gateways), replace the build-time `VITE_API_BASE_URL` with a runtime fetch of `/runtime-config.js` served by nginx with `no-cache`.
10. **CSP for inline boot screen** — `index.html` carries an inline `<style>` for the pre-hydration boot screen; add a nonce or migrate to an external stylesheet when CSP is tightened.

---

## 11. Constraints respected

| Constraint | Status |
|---|---|
| Do NOT use `npm run dev` in containers | ✅ Builder runs `npm run build` only; runtime is nginx, no Node. |
| Do NOT expose the Vite dev server in production | ✅ The dev server is host-side only; no port maps it in the compose file. |
| Do NOT remove route splitting | ✅ Per-route chunks intact in `dist/assets/`. |
| Do NOT remove lazy loading | ✅ `React.lazy()` boundaries unchanged. |
| Do NOT remove 3D support | ✅ `three-vendor` chunk shipped (820 KB / 221 KB gz); `VITE_ENABLE_3D=true` in the production build. |
| Do NOT simplify the frontend | ✅ No components, styles, or animations removed. |
| Do NOT bypass the gateway | ✅ Every `/api/**` request goes through nginx → api-gateway, which validates the JWT before routing. |
| Do NOT hardcode localhost | ✅ Container-side communication uses Docker DNS (`api-gateway:8080`). Browser-side communication uses relative URLs (same-origin). The only literal `localhost` is the host port the user types into the browser. |
