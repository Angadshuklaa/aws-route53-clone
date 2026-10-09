#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

exec .venv/bin/uvicorn app.main:create_app --factory \
  --host "${IP:-${HOST:-0.0.0.0}}" \
  --port "${PORT:-8000}" \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips "*"
