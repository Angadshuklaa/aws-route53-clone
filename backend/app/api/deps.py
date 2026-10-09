from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.errors import UnauthorizedError
from app.models import AuthSession, HostedZone
from app.services import auth_service, hosted_zone_service


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def require_session(request: Request, db: DbSession, settings: AppSettings) -> AuthSession:
    session = auth_service.get_session(db, request.cookies.get(settings.session_cookie_name))
    if session is None:
        raise UnauthorizedError("You're not signed in, or your session has expired.")
    return session


CurrentSession = Annotated[AuthSession, Depends(require_session)]


def get_zone_or_404(zone_id: str, db: DbSession) -> HostedZone:
    return hosted_zone_service.get_zone(db, zone_id)


ZoneFromPath = Annotated[HostedZone, Depends(get_zone_or_404)]
