# =============================================================================
# Blinkit AI Recommendation Service — multi-stage Dockerfile
# -----------------------------------------------------------------------------
# Stage 1: builder — installs all Python deps into a virtualenv.
# Stage 2: runtime — slim runtime, non-root user, virtualenv copied from builder.
#
# AKS-relevant size note: an earlier build of this image was 8.6 GB because
# `pip install sentence-transformers` pulled the default CUDA-enabled PyTorch
# wheel (1.2 GB), plus nvidia/* CUDA libraries (2.7 GB) and triton (641 MB).
# We don't run on GPU pods, so all of that is dead weight. This Dockerfile
# now installs the CPU-only PyTorch wheel FIRST from the pytorch.org CPU
# index, so sentence-transformers picks up the already-installed CPU torch
# and never sees CUDA at all. The runtime image shrinks ~5x.
# =============================================================================

# ----- builder ---------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build deps for scikit-learn / numpy wheels. `build-essential` is only used
# at install time and never reaches the runtime image (the runtime stage
# COPYs `/opt/venv` only).
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
    # Install CPU-only torch FIRST from pytorch.org's CPU index. Pinning to
    # 2.x keeps it compatible with sentence-transformers' install_requires.
    # `--index-url` (not --extra-index-url) ensures pip will NOT silently
    # resolve to the default PyPI torch wheel (which is CUDA-enabled).
    && pip install --index-url https://download.pytorch.org/whl/cpu \
        "torch>=2.2,<3.0" \
    # Now install the rest of the runtime deps. sentence-transformers sees
    # a satisfied torch dependency and does NOT re-resolve a CUDA wheel.
    && pip install -r requirements.txt \
    # Strip cached __pycache__ + tests bundled into wheels. Shaves ~80MB
    # without changing behaviour (Python regenerates .pyc on first import,
    # which we accept because container start latency dominates anyway).
    && find /opt/venv -type d -name "__pycache__"  -prune -exec rm -rf {} + \
    && find /opt/venv -type d -name "tests"        -prune -exec rm -rf {} + \
    && find /opt/venv -type d -name "test"         -prune -exec rm -rf {} +

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
