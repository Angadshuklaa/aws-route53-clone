# Backend

FastAPI + SQLite API for the Route 53 clone. See the [root README](../README.md)
for the API reference, database schema and deployment notes.

```bash
uv venv --python 3.13 .venv    # or: python3 -m venv .venv
uv pip install --python .venv/bin/python -r requirements-dev.txt
.venv/bin/uvicorn app.main:create_app --factory --reload   # http://127.0.0.1:8000/api/docs
.venv/bin/python -m pytest
```
