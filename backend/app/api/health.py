from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app import __version__
from app.database import check_database, utc_now

router = APIRouter(prefix="/api", tags=["Operations"])


@router.get("/health")
def health(request: Request) -> JSONResponse:
    """Liveness check that also confirms the SQLite database is readable."""
    database_ok = check_database(request.app.state.engine)
    return JSONResponse(
        status_code=200 if database_ok else 503,
        content={
            "status": "ok" if database_ok else "degraded",
            "database": "ok" if database_ok else "unavailable",
            "version": __version__,
            "time": utc_now().isoformat(timespec="seconds"),
        },
    )
