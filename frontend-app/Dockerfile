# =============================================================================
# Blinkit Frontend — multi-stage container image
# -----------------------------------------------------------------------------
# Stage 1 ("builder")  - node:20-alpine, runs `npm ci && npm run build`
# Stage 2 ("runtime")  - nginx:alpine, serves the static `dist/` and reverse-
#                         proxies `/api/**` into the api-gateway over the
#                         shared Docker bridge network.
#
# Why a reverse-proxy and not direct browser->gateway?
#   - The browser sees one origin (this nginx). Every API call is same-origin,
#     so CORS preflights disappear entirely.
#   - The api-gateway is reachable by Docker DNS at `http://api-gateway:8080`
#     from inside the network. It does NOT need to be exposed on the host.
#   - When this lifts to AKS, the same nginx layer can sit in an init/sidecar
#     pattern or be replaced by an Azure App Gateway path-based rule — no
#     frontend code change required.
#
# What lands in the final image: nginx + the contents of `dist/` only.
# No node_modules, no source, no .env, no .git, no tsbuildinfo.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfile FIRST so npm-ci layer caches across source-only changes.
COPY package.json package-lock.json ./

# `npm ci` is deterministic and faster than `npm install`. `--no-audit
# --no-fund` removes the noisy banner from the build log.
RUN npm ci --no-audit --no-fund

# Copy the rest of the build context (filtered by .dockerignore).
COPY . .

# VITE_* env vars are inlined at build time. Defaults below switch axios to
# same-origin (empty baseURL), which is what the production nginx layer
# expects (it reverse-proxies /api/** into api-gateway). The values can be
# overridden by passing `--build-arg VITE_API_BASE_URL=https://...` for a
# direct-to-public-gateway build (no nginx proxy), e.g. AKS behind an
# external Azure App Gateway.
ARG VITE_API_BASE_URL=""
ARG VITE_API_TIMEOUT=15000
ARG VITE_AUTH_STORAGE_KEY=blinkit.auth
ARG VITE_APP_NAME=Blinkit
ARG VITE_APP_VERSION=0.1.0
ARG VITE_APP_ENV=production
ARG VITE_ENABLE_3D=true
ARG VITE_ENABLE_PARTICLES=true
ARG VITE_ENABLE_DEVTOOLS=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TIMEOUT=$VITE_API_TIMEOUT \
    VITE_AUTH_STORAGE_KEY=$VITE_AUTH_STORAGE_KEY \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_VERSION=$VITE_APP_VERSION \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_ENABLE_3D=$VITE_ENABLE_3D \
    VITE_ENABLE_PARTICLES=$VITE_ENABLE_PARTICLES \
    VITE_ENABLE_DEVTOOLS=$VITE_ENABLE_DEVTOOLS

# `npm run build` runs `tsc -b && vite build` — type errors fail the image.
RUN npm run build


# -----------------------------------------------------------------------------
# Stage 2 — Runtime
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Drop the default site config and ship our own (SPA fallback, /api proxy,
# security headers, gzip, immutable asset caching).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Bring the compiled assets from the builder stage. Nothing else moves over —
# no node_modules, no src, no .env, no Dockerfile, no tsbuildinfo.
COPY --from=builder /app/dist /usr/share/nginx/html

# wget is preinstalled on nginx:alpine; we use it for the healthcheck instead
# of curl to keep the image lean. Healthcheck succeeds only if nginx is
# actually serving index.html with the runtime-config marker.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost/ 2>/dev/null | grep -q "<title>Blinkit" || exit 1

EXPOSE 80

# nginx:alpine's default ENTRYPOINT runs nginx in the foreground.
