from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


class NotFoundError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(404, "NOT_FOUND", message)


class ConflictError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(409, "CONFLICT", message)


class BadRequestError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(400, "BAD_REQUEST", message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication is required.") -> None:
        super().__init__(401, "UNAUTHORIZED", message)


class FieldValidationError(AppError):
    def __init__(self, details: list[dict[str, str]]) -> None:
        message = details[0]["message"] if len(details) == 1 else "The request contains invalid values."
        super().__init__(422, "VALIDATION_ERROR", message, details)


def error_body(code: str, message: str, details: list[dict[str, str]] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or []}}


def _format_loc(loc: tuple[Any, ...]) -> str:
    parts = [part for part in loc if part not in {"body", "query", "path"}]
    field = ""
    for part in parts:
        if isinstance(part, int):
            field += f"[{part}]"
        else:
            field += f".{part}" if field else str(part)
    return field or "request"


def _clean_message(message: str) -> str:
    return message.removeprefix("Value error, ").removeprefix("Assertion failed, ")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"field": _format_loc(tuple(err.get("loc", ()))), "message": _clean_message(err.get("msg", ""))}
            for err in exc.errors()
        ]
        message = details[0]["message"] if len(details) == 1 else "The request contains invalid values."
        return JSONResponse(error_body("VALIDATION_ERROR", message, details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        codes = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 401: "UNAUTHORIZED"}
        code = codes.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(error_body(code, message), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(Exception)
    async def _unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(
            error_body("INTERNAL_ERROR", "An unexpected error occurred. Please try again."), status_code=500
        )
