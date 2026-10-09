#!/bin/bash
# Usage (PythonAnywhere Bash console):
#   curl -fsSL https://raw.githubusercontent.com/Angadshuklaa/aws-route53-clone/main/backend/deploy/pythonanywhere-setup.sh | bash
set -euo pipefail

REPO_URL="https://github.com/Angadshuklaa/aws-route53-clone.git"
APP_DIR="$HOME/aws-route53-clone"
DATA_DIR="$HOME/route53-data"

PYTHON=""
for candidate in python3.13 python3.12 python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then PYTHON="$candidate"; break; fi
done
[ -n "$PYTHON" ] || { echo "Python 3.11+ is required" >&2; exit 1; }
echo "Using $PYTHON"

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin main
  git -C "$APP_DIR" reset --quiet --hard origin/main
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi

mkdir -p "$DATA_DIR"
cd "$APP_DIR/backend"
[ -d .venv ] || "$PYTHON" -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

if [ ! -f .env ]; then
  cat > .env <<ENV
APP_ENV=production
DATABASE_PATH=$DATA_DIR/route53.db
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
SEED_DEMO_DATA=true
LOG_LEVEL=INFO
ENV
  echo "Wrote $APP_DIR/backend/.env"
fi

.venv/bin/python -c "import wsgi" && echo "Database ready at $DATA_DIR/route53.db"
echo "PYTHON_VERSION=$PYTHON"
echo "Setup complete."
