# =============================================================================
# Blinkit AI Recommendation Service — multi-stage Dockerfile
# -----------------------------------------------------------------------------
# Stage 1: builder — installs all Python deps into a virtualenv.
# Stage 2: runtime — slim runtime, non-root user, virtualenv copied from builder.
#
# The sentence-transformers / torch wheels make the runtime image large
# (~1.5 GB). For environments that only need TF-IDF (CI, dev preview),
# build with --build-arg EMBEDDING_BACKEND=tfidf and the heavy deps can
# be skipped at install time by trimming requirements.txt — left as a
# follow-up so the default image matches the documented spec.
# =============================================================================

# ----- builder ---------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build deps for scikit-learn / numpy / torch wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Create an isolated venv so the runtime stage gets a clean copy.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# ----- runtime ---------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    SERVICE_PORT=8090 \
    PYTHONPATH=/app

# Non-root user (matches the JVM service convention).
RUN groupadd --system app \
    && useradd --system --gid app --home /app --shell /usr/sbin/nologin appuser \
    && mkdir -p /app \
    && chown -R appuser:app /app

# Minimal runtime libs (curl is used by the healthcheck).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the prepared virtualenv from the builder stage.
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=appuser:app app ./app

USER appuser

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:${SERVICE_PORT}/health/liveness || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${SERVICE_PORT} --workers 1"]
