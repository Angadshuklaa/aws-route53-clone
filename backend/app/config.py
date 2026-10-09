from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    environment: str
    database_path: str
    cors_allowed_origins: list[str]
    session_cookie_name: str
    session_cookie_secure: bool
    session_cookie_samesite: str
    session_ttl_hours: int
    demo_account_id: str
    demo_username: str
    demo_password: str
    seed_demo_data: bool
    log_level: str

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    def validate(self) -> None:
        if self.session_cookie_samesite not in {"lax", "strict", "none"}:
            raise ValueError("SESSION_COOKIE_SAMESITE must be one of: lax, strict, none")
        if self.session_cookie_samesite == "none" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true")
        if "*" in self.cors_allowed_origins:
            raise ValueError("CORS_ALLOWED_ORIGINS must list explicit origins, not '*'")
        if self.session_ttl_hours <= 0:
            raise ValueError("SESSION_TTL_HOURS must be positive")


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_settings(**overrides: object) -> Settings:
    environment = os.getenv("APP_ENV", "development").strip().lower()
    is_production = environment == "production"
    values: dict[str, object] = {
        "environment": environment,
        "database_path": os.getenv("DATABASE_PATH", str(BACKEND_ROOT / "data" / "route53.db")),
        "cors_allowed_origins": _env_list(
            "CORS_ALLOWED_ORIGINS", ["http://localhost:3000", "http://127.0.0.1:3000"]
        ),
        "session_cookie_name": os.getenv("SESSION_COOKIE_NAME", "r53_session"),
        "session_cookie_secure": _env_bool("SESSION_COOKIE_SECURE", is_production),
        "session_cookie_samesite": os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower(),
        "session_ttl_hours": int(os.getenv("SESSION_TTL_HOURS", "12")),
        "demo_account_id": os.getenv("DEMO_ACCOUNT_ID", "123456789012"),
        "demo_username": os.getenv("DEMO_USERNAME", "demo"),
        "demo_password": os.getenv("DEMO_PASSWORD", "Route53Demo!"),
        "seed_demo_data": _env_bool("SEED_DEMO_DATA", True),
        "log_level": os.getenv("LOG_LEVEL", "INFO").upper(),
    }
    values.update(overrides)
    settings = Settings(**values)  # type: ignore[arg-type]
    settings.validate()
    return settings
