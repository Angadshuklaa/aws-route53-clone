FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    DATABASE_PATH=/data/route53.db

WORKDIR /app
COPY requirements.txt .
RUN python -m venv .venv && .venv/bin/pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts

VOLUME ["/data"]
EXPOSE 8000
CMD ["./scripts/start.sh"]
