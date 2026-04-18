# syntax=docker/dockerfile:1.6
# ---------- builder ----------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      git \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ---------- runtime ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LIGHTRAG_WORKSPACE=/app/workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 eclipse

COPY --from=builder /install /usr/local

WORKDIR /app
COPY main.py ./

RUN mkdir -p /app/workspace && chown -R eclipse:eclipse /app
USER eclipse

EXPOSE 8801

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8801/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8801"]
