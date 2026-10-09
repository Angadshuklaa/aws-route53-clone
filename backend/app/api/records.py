from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, ZoneFromPath, require_session
from app.schemas.common import ERROR_RESPONSES, Page, SearchTerm
from app.schemas.dns_record import (
    BulkDeleteRequest,
    BulkDeleteResult,
    RecordCreate,
    RecordOut,
    RecordType,
    RecordUpdate,
)
from app.services import record_service

router = APIRouter(
    prefix="/api/hosted-zones/{zone_id}/records",
    tags=["DNS records"],
    dependencies=[Depends(require_session)],
    responses=ERROR_RESPONSES,
)


@router.get("", response_model=Page[RecordOut])
def list_records(
    zone: ZoneFromPath,
    db: DbSession,
    search: Annotated[list[SearchTerm] | None, Query(description="Matches record name, type or value; repeat to narrow")] = None,
    name: Annotated[list[SearchTerm] | None, Query(description="Record name contains")] = None,
    value: Annotated[list[SearchTerm] | None, Query(description="A record value contains")] = None,
    type: Annotated[list[RecordType] | None, Query(description="Repeat to filter by several types")] = None,  # noqa: A002
    routing_policy: Annotated[list[SearchTerm] | None, Query(description="For example SIMPLE or WEIGHTED")] = None,
    alias: Annotated[bool | None, Query(description="Only alias records (true) or only non-alias records (false)")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    sort_by: Literal["name", "type", "ttl"] = "name",
    sort_order: Literal["asc", "desc"] = "asc",
) -> Page[RecordOut]:
    result = record_service.list_records(
        db,
        zone,
        search=search or [],
        names=name or [],
        values=value or [],
        types=type or [],
        routing_policies=routing_policy or [],
        alias=alias,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return Page.build(result.items, result.total, page, page_size)


@router.post("", response_model=RecordOut, status_code=status.HTTP_201_CREATED)
def create_record(zone: ZoneFromPath, body: RecordCreate, db: DbSession) -> RecordOut:
    record = record_service.create_record(db, zone, body)
    return record_service.to_record_out(record, zone)


@router.post("/batch-delete", response_model=BulkDeleteResult)
def batch_delete_records(zone: ZoneFromPath, body: BulkDeleteRequest, db: DbSession) -> BulkDeleteResult:
    """Delete several records. Records that can't be deleted are reported in ``failed``."""
    return record_service.bulk_delete_records(db, zone, body.record_ids)


@router.get("/{record_id}", response_model=RecordOut)
def get_record(zone: ZoneFromPath, record_id: int, db: DbSession) -> RecordOut:
    return record_service.to_record_out(record_service.get_record(db, zone, record_id), zone)


@router.put("/{record_id}", response_model=RecordOut)
def update_record(zone: ZoneFromPath, record_id: int, body: RecordUpdate, db: DbSession) -> RecordOut:
    record = record_service.update_record(db, zone, record_id, body)
    return record_service.to_record_out(record, zone)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(zone: ZoneFromPath, record_id: int, db: DbSession) -> Response:
    record_service.delete_record(db, zone, record_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
