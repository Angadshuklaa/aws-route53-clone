"""WSGI entry point for hosts that only run WSGI apps (e.g. PythonAnywhere's free plan).

FastAPI is an ASGI app, so it is wrapped with a2wsgi. Lifespan events don't
run under WSGI, so the database is initialised here at import time instead.
Settings are read from backend/.env when the host can't set environment
variables.
"""

from pathlib import Path

from a2wsgi import ASGIMiddleware

from app.config import load_env_file

load_env_file(Path(__file__).resolve().parent / ".env")

from app.main import create_app, initialize_database  # noqa: E402 - must follow load_env_file

app = create_app()
initialize_database(app)
application = ASGIMiddleware(app)
