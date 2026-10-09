import threading
from pathlib import Path

from a2wsgi import ASGIMiddleware

from app.config import load_env_file

load_env_file(Path(__file__).resolve().parent / ".env")

from app.main import create_app, initialize_database  # noqa: E402

app = create_app()
initialize_database(app)
app.state.engine.dispose()

# uWSGI forks after importing this module, so the adapter (and its event loop
# thread) has to be created inside the worker.

_adapter: ASGIMiddleware | None = None
_adapter_lock = threading.Lock()


def application(environ, start_response):  # noqa: ANN001, ANN201
    global _adapter
    if _adapter is None:
        with _adapter_lock:
            if _adapter is None:
                _adapter = ASGIMiddleware(app)
    return _adapter(environ, start_response)
