from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app import __version__
from app.api import routers
from app.config import Settings, load_settings
from app.database import create_db_engine, create_session_factory, run_migrations
from app.errors import register_exception_handlers
from app.seed import seed_demo_data

logger = logging.getLogger("app")


def initialize_database(app: FastAPI) -> None:
    settings: Settings = app.state.settings
    applied = run_migrations(app.state.engine)
    logger.info(
        "Database ready at %s (%s)",
        settings.database_path,
        f"applied {', '.join(applied)}" if applied else "schema up to date",
    )
    if settings.seed_demo_data:
        seed_demo_data(app.state.session_factory)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    engine = create_db_engine(settings.database_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        initialize_database(app)
        yield
        engine.dispose()

    app = FastAPI(
        title="Route 53 Clone API",
        version=__version__,
        description=(
            "REST API behind the Route 53 console clone. Hosted zones and DNS records are stored in "
            "SQLite. Sign in with `POST /api/auth/login`; the session cookie authenticates the other calls."
        ),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
        max_age=600,
    )
    register_exception_handlers(app)
    for router in routers:
        app.include_router(router)

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse("/api/docs")

    logger.info("Starting Route 53 Clone API %s (%s)", __version__, settings.environment)
    return app
