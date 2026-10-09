"""Business logic for DNS record sets inside a hosted zone."""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass

from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import utc_now
from app.errors import BadRequestError, ConflictError, FieldValidationError, NotFoundError
from app.models import DnsRecord, DnsRecordValue, HostedZone
from app.schemas.dns_record import (
    BulkDeleteFailure,
    BulkDeleteResult,
    RecordCreate,
    RecordOut,
    RecordUpdate,
    RecordValueOut,
)
from app.services.dns_rules import (
    NormalizedValue,
    format_value,
    normalize_record_name,
    normalize_record_values,
    validate_ttl,
)
from app.services.query_utils import like_pattern

logger = logging.getLogger(__name__)

RECORD_SORT_COLUMNS = {"name", "type", "ttl"}


@dataclass
class RecordListResult:
    items: list[RecordOut]
    total: int


def is_system_record(record: DnsRecord, zone: HostedZone) -> bool:
    return record.name == zone.name and record.type in {"NS", "SOA"}


def to_record_out(record: DnsRecord, zone: HostedZone) -> RecordOut:
    return RecordOut(
        id=record.id,
        zone_id=record.zone_id,
        name=record.name,
        type=record.type,  # type: ignore[arg-type]
        ttl=record.ttl,
        values=[
            RecordValueOut(
                value=v.value, priority=v.priority, weight=v.weight, port=v.port, flags=v.flags, tag=v.tag
            )
            for v in record.values
        ],
        formatted_values=[format_value(record.type, v) for v in record.values],
        is_system=is_system_record(record, zone),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_records(
    db: Session,
    zone: HostedZone,
    *,
    search: str | None,
    types: list[str],
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> RecordListResult:
    query = select(DnsRecord).where(DnsRecord.zone_id == zone.id)
    if types:
        query = query.where(DnsRecord.type.in_(types))
    if search and search.strip():
        term = search.strip()
        pattern = like_pattern(term)
        value_matches = exists().where(
            DnsRecordValue.record_id == DnsRecord.id, DnsRecordValue.value.like(pattern, escape="\\")
        )
        query = query.where(
            or_(DnsRecord.name.like(pattern, escape="\\"), DnsRecord.type == term.upper(), value_matches)
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    apex_first = case((DnsRecord.name == zone.name, 0), else_=1)
    type_rank = case((DnsRecord.type == "NS", 0), (DnsRecord.type == "SOA", 1), else_=2)
    descending = sort_order == "desc"
    if sort_by == "type":
        order = [DnsRecord.type.desc() if descending else DnsRecord.type.asc(), DnsRecord.name.asc()]
    elif sort_by == "ttl":
        order = [DnsRecord.ttl.desc() if descending else DnsRecord.ttl.asc(), DnsRecord.name.asc()]
    elif descending:
        order = [apex_first.desc(), DnsRecord.name.desc(), type_rank.desc(), DnsRecord.type.desc()]
    else:
        order = [apex_first, DnsRecord.name.asc(), type_rank, DnsRecord.type.asc()]
    query = query.order_by(*order, DnsRecord.id).offset((page - 1) * page_size).limit(page_size)

    records = db.execute(query).scalars().all()
    return RecordListResult(items=[to_record_out(r, zone) for r in records], total=total)


def get_record(db: Session, zone: HostedZone, record_id: int) -> DnsRecord:
    record = db.get(DnsRecord, record_id)
    # A record is only reachable through the zone it belongs to.
    if record is None or record.zone_id != zone.id:
        raise NotFoundError(f"No record with ID {record_id} exists in hosted zone {zone.id}.")
    return record


def _normalize_name(name: str, zone: HostedZone) -> str:
    try:
        return normalize_record_name(name, zone.name)
    except ValueError as exc:
        raise FieldValidationError([{"field": "name", "message": str(exc)}]) from exc


def check_conflicts(db: Session, zone: HostedZone, name: str, record_type: str, exclude_id: int | None) -> None:
    if record_type == "CNAME" and name == zone.name:
        raise BadRequestError(
            f"You can't create a CNAME record at the zone apex ({zone.name}). Use an A or AAAA record instead."
        )
    query = select(DnsRecord.type).where(DnsRecord.zone_id == zone.id, DnsRecord.name == name)
    if exclude_id is not None:
        query = query.where(DnsRecord.id != exclude_id)
    existing_types = set(db.execute(query).scalars())
    if record_type in existing_types:
        raise ConflictError(f"A record with the name {name} and type {record_type} already exists.")
    if record_type == "CNAME" and existing_types:
        raise ConflictError(
            f"A CNAME record can't share its name with other records. {name} already has: "
            f"{', '.join(sorted(existing_types))}."
        )
    if record_type != "CNAME" and "CNAME" in existing_types:
        raise ConflictError(f"{name} already has a CNAME record, so no other record can use that name.")


def apply_values(record: DnsRecord, values: list[NormalizedValue]) -> None:
    # Reuse rows by position so the (record_id, position) unique key never
    # collides inside a single flush.
    existing = list(record.values)
    for position, value in enumerate(values):
        if position < len(existing):
            row = existing[position]
            for field, field_value in asdict(value).items():
                setattr(row, field, field_value)
        else:
            record.values.append(DnsRecordValue(position=position, **asdict(value)))
    for row in existing[len(values) :]:
        record.values.remove(row)


def _commit(db: Session, name: str, record_type: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(f"A record with the name {name} and type {record_type} already exists.") from exc


def create_record(db: Session, zone: HostedZone, data: RecordCreate) -> DnsRecord:
    name = _normalize_name(data.name, zone)
    validate_ttl(data.ttl)
    values = normalize_record_values(data.type, data.values)
    check_conflicts(db, zone, name, data.type, exclude_id=None)

    now = utc_now()
    record = DnsRecord(zone_id=zone.id, name=name, type=data.type, ttl=data.ttl, created_at=now, updated_at=now)
    apply_values(record, values)
    db.add(record)
    _commit(db, name, data.type)
    logger.info("Created %s record %s in zone %s", record.type, record.name, zone.id)
    return record


def update_record(db: Session, zone: HostedZone, record_id: int, data: RecordUpdate) -> DnsRecord:
    record = get_record(db, zone, record_id)
    name = _normalize_name(data.name, zone)
    if is_system_record(record, zone):
        if name != record.name or data.type != record.type:
            raise BadRequestError("You can't change the name or type of the NS and SOA records at the zone apex.")
    elif data.type == "SOA":
        raise BadRequestError("Route 53 manages the SOA record. You can't create another one.")
    validate_ttl(data.ttl)
    values = normalize_record_values(data.type, data.values)
    check_conflicts(db, zone, name, data.type, exclude_id=record.id)

    record.name = name
    record.type = data.type
    record.ttl = data.ttl
    apply_values(record, values)
    record.updated_at = utc_now()
    _commit(db, name, data.type)
    logger.info("Updated %s record %s in zone %s", record.type, record.name, zone.id)
    return record


def delete_record(db: Session, zone: HostedZone, record_id: int) -> None:
    record = get_record(db, zone, record_id)
    if is_system_record(record, zone):
        raise BadRequestError(f"You can't delete the {record.type} record at the zone apex.")
    db.delete(record)
    db.commit()
    logger.info("Deleted %s record %s in zone %s", record.type, record.name, zone.id)


def bulk_delete_records(db: Session, zone: HostedZone, record_ids: list[int]) -> BulkDeleteResult:
    deleted: list[int] = []
    failed: list[BulkDeleteFailure] = []
    for record_id in dict.fromkeys(record_ids):  # de-duplicate, keep order
        record = db.get(DnsRecord, record_id)
        if record is None or record.zone_id != zone.id:
            failed.append(BulkDeleteFailure(id=record_id, message="Record not found in this hosted zone."))
        elif is_system_record(record, zone):
            failed.append(
                BulkDeleteFailure(id=record_id, message=f"The {record.type} record at the zone apex can't be deleted.")
            )
        else:
            db.delete(record)
            deleted.append(record_id)
    db.commit()
    logger.info("Bulk deleted %d records in zone %s (%d failed)", len(deleted), zone.id, len(failed))
    return BulkDeleteResult(deleted=deleted, failed=failed)
