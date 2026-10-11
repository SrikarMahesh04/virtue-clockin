#!/usr/bin/env bash
set -euo pipefail

# Run from backend/. Configuration validation fails before migrations if unsafe.
uv run --frozen --no-dev alembic upgrade head
exec uv run --frozen --no-dev uvicorn app.main:app \
  --host 0.0.0.0 --port "${PORT:-8000}" --no-proxy-headers --no-access-log
