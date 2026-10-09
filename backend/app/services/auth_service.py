"""Mocked sign-in backed by server-side sessions stored in SQLite.

There is a single demo IAM user configured through environment variables.
The browser only ever holds an opaque random token in an HTTP-only cookie;
the database stores its SHA-256 hash.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import utc_now
from app.errors import AppError
from app.models import AuthSession

logger = logging.getLogger(__name__)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _matches(supplied: str, expected: str) -> bool:
    return hmac.compare_digest(supplied.encode(), expected.encode())


def authenticate(settings: Settings, account_id: str, username: str, password: str) -> None:
    account_ok = _matches(account_id.replace("-", ""), settings.demo_account_id)
    user_ok = _matches(username, settings.demo_username)
    password_ok = _matches(password, settings.demo_password)
    if not (account_ok and user_ok and password_ok):
        logger.info("Failed sign-in attempt for user %r", username)
        raise AppError(401, "INVALID_CREDENTIALS", "Your authentication information is incorrect. Please try again.")


def create_session(db: Session, settings: Settings) -> tuple[str, AuthSession]:
    now = utc_now()
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
    token = secrets.token_urlsafe(32)
    session = AuthSession(
        token_hash=_hash_token(token),
        username=settings.demo_username,
        account_id=settings.demo_account_id,
        created_at=now,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(session)
    db.commit()
    logger.info("User %s signed in", session.username)
    return token, session


def get_session(db: Session, token: str | None) -> AuthSession | None:
    if not token:
        return None
    session = db.get(AuthSession, _hash_token(token))
    if session is None:
        return None
    if session.expires_at <= utc_now():
        db.delete(session)
        db.commit()
        return None
    return session


def end_session(db: Session, token: str | None) -> None:
    if not token:
        return
    db.execute(delete(AuthSession).where(AuthSession.token_hash == _hash_token(token)))
    db.commit()
