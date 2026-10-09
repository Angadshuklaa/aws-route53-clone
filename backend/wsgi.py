"""WSGI entry point for hosts that only run WSGI apps (e.g. PythonAnywhere's free plan).

FastAPI is an ASGI app, so it is wrapped with a2wsgi. Two details matter on
pre-forking servers such as uWSGI, which import this module in a master
process and then fork the workers:

* Lifespan events don't run under WSGI, so the database is initialised here
  at import time.
* a2wsgi runs its event loop in a background thread, and threads don't
  survive a fork. The adapter is therefore created lazily, inside the worker,
  on its first request. Pooled database connections opened in the master are
  closed for the same reason.

Settings are read from backend/.env when the host can't set environment
variables.
"""

import threading
from pathlib import Path

from a2wsgi import ASGIMiddleware

from app.config import load_env_file

load_env_file(Path(__file__).resolve().parent / ".env")

from app.main import create_app, initialize_database  # noqa: E402 - must follow load_env_file

app = create_app()
initialize_database(app)
app.state.engine.dispose()  # don't hand pre-fork SQLite connections to workers

_adapter: ASGIMiddleware | None = None
_adapter_lock = threading.Lock()


def application(environ, start_response):  # noqa: ANN001, ANN201 - WSGI signature
    global _adapter
    if _adapter is None:
        with _adapter_lock:
            if _adapter is None:
                _adapter = ASGIMiddleware(app)
    return _adapter(environ, start_response)
