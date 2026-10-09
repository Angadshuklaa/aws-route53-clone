from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.api.deps import AppSettings, CurrentSession, DbSession
from app.schemas.auth import CurrentUser, LoginRequest
from app.schemas.common import ErrorResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=CurrentUser,
    responses={401: {"model": ErrorResponse, "description": "Wrong credentials"}},
)
def login(body: LoginRequest, response: Response, db: DbSession, settings: AppSettings) -> CurrentUser:
    """Sign in with the demo IAM user and receive an HTTP-only session cookie."""
    auth_service.authenticate(settings, body.account_id, body.username, body.password)
    token, session = auth_service.create_session(db, settings)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,  # type: ignore[arg-type]
        path="/",
    )
    return CurrentUser(
        username=session.username, account_id=session.account_id, session_expires_at=session.expires_at
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: DbSession, settings: AppSettings) -> Response:
    """End the current session (if any) and clear the cookie."""
    auth_service.end_session(db, request.cookies.get(settings.session_cookie_name))
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,  # type: ignore[arg-type]
    )
    return response


@router.get(
    "/me",
    response_model=CurrentUser,
    responses={401: {"model": ErrorResponse, "description": "Not signed in"}},
)
def me(session: CurrentSession) -> CurrentUser:
    """Return the signed-in user, or 401 when there is no valid session."""
    return CurrentUser(
        username=session.username, account_id=session.account_id, session_expires_at=session.expires_at
    )
