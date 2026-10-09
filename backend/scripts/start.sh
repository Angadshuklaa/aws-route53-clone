#!/bin/sh
# Production start command. Hosting platforms provide the bind address and
# port ($IP/$HOST and $PORT); a single worker is used because SQLite
# serialises writes anyway. Settings can live in backend/.env on the server.
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
