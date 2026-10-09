from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import DbSession, ZoneFromPath, require_session
from app.schemas.common import ERROR_RESPONSES, Page, SearchTerm
from app.schemas.dns_record import ZoneImportRequest, ZoneImportResult
from app.schemas.hosted_zone import HostedZoneCreate, HostedZoneOut, HostedZoneUpdate, ZoneType
from app.services import hosted_zone_service, zone_file_service

router = APIRouter(
    prefix="/api/hosted-zones",
    tags=["Hosted zones"],
    dependencies=[Depends(require_session)],
    responses=ERROR_RESPONSES,
)


@router.get("", response_model=Page[HostedZoneOut])
def list_hosted_zones(
    db: DbSession,
    search: Annotated[list[SearchTerm] | None, Query(description="Matches name, ID or description; repeat to narrow")] = None,
    name: Annotated[list[SearchTerm] | None, Query(description="Hosted zone name contains")] = None,
    type: Annotated[list[ZoneType] | None, Query(description="PUBLIC or PRIVATE; repeat for either")] = None,  # noqa: A002
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
    sort_by: Literal["name", "type", "record_count", "created_at"] = "name",
    sort_order: Literal["asc", "desc"] = "asc",
) -> Page[HostedZoneOut]:
    result = hosted_zone_service.list_zones(
        db,
        search=search or [],
        names=name or [],
        zone_types=type or [],
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return Page.build(result.items, result.total, page, page_size)


@router.post("", response_model=HostedZoneOut, status_code=status.HTTP_201_CREATED)
def create_hosted_zone(body: HostedZoneCreate, db: DbSession) -> HostedZoneOut:
    zone = hosted_zone_service.create_zone(db, body)
    return hosted_zone_service.to_zone_out(db, zone)


@router.get("/{zone_id}", response_model=HostedZoneOut)
def get_hosted_zone(zone: ZoneFromPath, db: DbSession) -> HostedZoneOut:
    return hosted_zone_service.to_zone_out(db, zone)


@router.put("/{zone_id}", response_model=HostedZoneOut)
def update_hosted_zone(zone_id: str, body: HostedZoneUpdate, db: DbSession) -> HostedZoneOut:
    """Replace the editable fields (description, tags and, for private zones, the VPC)."""
    zone = hosted_zone_service.update_zone(db, zone_id, body)
    return hosted_zone_service.to_zone_out(db, zone)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hosted_zone(zone_id: str, db: DbSession) -> Response:
    """Delete the zone. Its records are deleted with it (ON DELETE CASCADE)."""
    hosted_zone_service.delete_zone(db, zone_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{zone_id}/export",
    response_class=Response,
    responses={200: {"content": {"text/plain": {}, "application/json": {}}}},
)
def export_hosted_zone(
    zone: ZoneFromPath, db: DbSession, format: Literal["bind", "json"] = "bind"  # noqa: A002
) -> Response:
    """Download the zone and its records as a BIND zone file or JSON."""
    if format == "json":
        body, media_type, extension = zone_file_service.export_json(db, zone), "application/json", "json"
    else:
        body, media_type, extension = zone_file_service.export_bind(zone), "text/plain", "zone"
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{zone.name}.{extension}"'},
    )


@router.post("/{zone_id}/import", response_model=ZoneImportResult)
def import_zone_file(zone: ZoneFromPath, body: ZoneImportRequest, db: DbSession) -> ZoneImportResult:
    """Import records from BIND zone file text. Invalid entries are reported, not stored."""
    return zone_file_service.import_zone_file(db, zone, body.content, body.overwrite)
