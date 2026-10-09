from __future__ import annotations

from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, StringConstraints

T = TypeVar("T")

SearchTerm = Annotated[str, StringConstraints(max_length=255)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int, page_size: int) -> Page[T]:
        total_pages = max(1, -(-total // page_size))
        return cls(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


class ErrorDetail(BaseModel):
    field: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = []


class ErrorResponse(BaseModel):
    error: ErrorBody


ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    401: {"model": ErrorResponse, "description": "Not signed in"},
    404: {"model": ErrorResponse, "description": "Resource not found"},
    422: {"model": ErrorResponse, "description": "Validation failed"},
}
