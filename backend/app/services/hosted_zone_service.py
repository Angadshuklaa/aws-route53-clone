from __future__ import annotations

import logging
import re
import secrets
import string
from dataclasses import dataclass

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.database import utc_now
from app.errors import ConflictError, FieldValidationError, NotFoundError
from app.models import DnsRecord, DnsRecordValue, HostedZone, HostedZoneTag
from app.schemas.hosted_zone import HostedZoneCreate, HostedZoneOut, HostedZoneUpdate, Tag
from app.services.dns_rules import generate_name_servers
from app.services.query_utils import like_pattern

logger = logging.getLogger(__name__)

AWS_REGIONS = (
    "us-east-1", "us-east-2", "us-west-1", "us-west-2", "af-south-1", "ap-east-1", "ap-south-1",
    "ap-south-2", "ap-southeast-1", "ap-southeast-2", "ap-southeast-3", "ap-southeast-4",
    "ap-northeast-1", "ap-northeast-2", "ap-northeast-3", "ca-central-1", "ca-west-1",
    "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3", "eu-south-1",
    "eu-south-2", "eu-north-1", "il-central-1", "me-south-1", "me-central-1", "sa-east-1",
)  # fmt: skip
_VPC_ID = re.compile(r"^vpc-[0-9a-f]{8}([0-9a-f]{9})?$")
_ID_ALPHABET = string.ascii_uppercase + string.digits

ZONE_SORT_COLUMNS = {"name", "type", "record_count", "created_at"}
DEFAULT_NS_TTL = 172800
DEFAULT_SOA_TTL = 900


@dataclass
class ZoneListResult:
    items: list[HostedZoneOut]
    total: int


def _record_count_subquery():  # noqa: ANN202
    return (
        select(func.count(DnsRecord.id))
        .where(DnsRecord.zone_id == HostedZone.id)
        .correlate(HostedZone)
        .scalar_subquery()
    )


def _apex_name_servers(db: Session, zone: HostedZone) -> list[str]:
    rows = db.execute(
        select(DnsRecordValue.value)
        .join(DnsRecord, DnsRecord.id == DnsRecordValue.record_id)
        .where(DnsRecord.zone_id == zone.id, DnsRecord.name == zone.name, DnsRecord.type == "NS")
        .order_by(DnsRecordValue.position)
    ).scalars()
    return list(rows)


def to_zone_out(db: Session, zone: HostedZone, record_count: int | None = None) -> HostedZoneOut:
    if record_count is None:
        record_count = db.scalar(select(func.count(DnsRecord.id)).where(DnsRecord.zone_id == zone.id)) or 0
    return HostedZoneOut(
        id=zone.id,
        name=zone.name,
        type=zone.type,  # type: ignore[arg-type]
        comment=zone.comment,
        vpc_id=zone.vpc_id,
        vpc_region=zone.vpc_region,
        record_count=record_count,
        name_servers=_apex_name_servers(db, zone),
        tags=[Tag(key=tag.key, value=tag.value) for tag in zone.tags],
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def list_zones(
    db: Session,
    *,
    search: list[str],
    names: list[str],
    zone_types: list[str],
    page: int,
    page_size: int,
    sort_by: str,
    sort_order: str,
) -> ZoneListResult:
    record_count = _record_count_subquery().label("record_count")
    query: Select = select(HostedZone, record_count)

    for term in filter(None, (t.strip() for t in search)):
        pattern = like_pattern(term)
        query = query.where(
            or_(
                HostedZone.name.like(pattern, escape="\\"),
                HostedZone.id.like(pattern, escape="\\"),
                HostedZone.comment.like(pattern, escape="\\"),
            )
        )
    for term in filter(None, (t.strip() for t in names)):
        query = query.where(HostedZone.name.like(like_pattern(term), escape="\\"))
    if zone_types:
        query = query.where(HostedZone.type.in_(zone_types))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0

    sort_column = {
        "name": HostedZone.name,
        "type": HostedZone.type,
        "record_count": record_count,
        "created_at": HostedZone.created_at,
    }[sort_by]
    ordering = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    query = query.order_by(ordering, HostedZone.name.asc(), HostedZone.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    items = [to_zone_out(db, zone, count) for zone, count in db.execute(query).all()]
    return ZoneListResult(items=items, total=total)


def get_zone(db: Session, zone_id: str) -> HostedZone:
    zone = db.get(HostedZone, zone_id)
    if zone is None:
        raise NotFoundError(f"No hosted zone found with ID: {zone_id}")
    return zone


def _validate_vpc(zone_type: str, vpc_id: str | None, vpc_region: str | None) -> tuple[str | None, str | None]:
    if zone_type == "PUBLIC":
        return None, None
    errors = []
    vpc_id = (vpc_id or "").strip().lower()
    vpc_region = (vpc_region or "").strip().lower()
    if not vpc_region:
        errors.append({"field": "vpc_region", "message": "Choose the Region of the VPC."})
    elif vpc_region not in AWS_REGIONS:
        errors.append({"field": "vpc_region", "message": "Choose a valid AWS Region."})
    if not vpc_id:
        errors.append({"field": "vpc_id", "message": "Enter the ID of the VPC to associate with this zone."})
    elif not _VPC_ID.match(vpc_id):
        errors.append({"field": "vpc_id", "message": "VPC IDs look like vpc-0a1b2c3d (8 or 17 hex characters)."})
    if errors:
        raise FieldValidationError(errors)
    return vpc_id, vpc_region


def _validate_tags(tags: list[Tag]) -> list[Tag]:
    seen: set[str] = set()
    errors = []
    for index, tag in enumerate(tags):
        if tag.key in seen:
            errors.append({"field": f"tags[{index}].key", "message": f'The tag key "{tag.key}" is used more than once.'})
        seen.add(tag.key)
    if errors:
        raise FieldValidationError(errors)
    return tags


def _new_zone_id(db: Session) -> str:
    while True:
        zone_id = "Z" + "".join(secrets.choice(_ID_ALPHABET) for _ in range(20))
        if db.get(HostedZone, zone_id) is None:
            return zone_id


def _ensure_unique(db: Session, name: str, zone_type: str, vpc_id: str | None, exclude_id: str | None = None) -> None:
    query = select(HostedZone.id).where(HostedZone.name == name, HostedZone.type == zone_type)
    if zone_type == "PRIVATE":
        query = query.where(HostedZone.vpc_id == vpc_id)
    if exclude_id:
        query = query.where(HostedZone.id != exclude_id)
    if db.scalar(query) is not None:
        if zone_type == "PUBLIC":
            raise ConflictError(f"A public hosted zone for {name} already exists.")
        raise ConflictError(f"A private hosted zone for {name} is already associated with {vpc_id}.")


def create_zone(db: Session, data: HostedZoneCreate) -> HostedZone:
    vpc_id, vpc_region = _validate_vpc(data.type, data.vpc_id, data.vpc_region)
    tags = _validate_tags(data.tags)
    _ensure_unique(db, data.name, data.type, vpc_id)

    now = utc_now()
    zone = HostedZone(
        id=_new_zone_id(db),
        name=data.name,
        type=data.type,
        comment=data.comment.strip(),
        vpc_id=vpc_id,
        vpc_region=vpc_region,
        created_at=now,
        updated_at=now,
        tags=[HostedZoneTag(key=tag.key, value=tag.value) for tag in tags],
    )

    name_servers = generate_name_servers(zone.id, private=data.type == "PRIVATE")
    zone.records = [
        DnsRecord(
            name=data.name,
            type="NS",
            ttl=DEFAULT_NS_TTL,
            created_at=now,
            updated_at=now,
            values=[DnsRecordValue(position=i, value=ns) for i, ns in enumerate(name_servers)],
        ),
        DnsRecord(
            name=data.name,
            type="SOA",
            ttl=DEFAULT_SOA_TTL,
            created_at=now,
            updated_at=now,
            values=[
                DnsRecordValue(
                    position=0,
                    value=f"{name_servers[0]}. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400",
                )
            ],
        ),
    ]
    db.add(zone)
    db.commit()
    logger.info("Created hosted zone %s (%s)", zone.name, zone.id)
    return zone


def _replace_tags(zone: HostedZone, tags: list[Tag]) -> None:
    # same idea as apply_values: reuse existing rows instead of delete + insert
    wanted = {tag.key: tag.value for tag in tags}
    for existing in list(zone.tags):
        if existing.key in wanted:
            existing.value = wanted.pop(existing.key)
        else:
            zone.tags.remove(existing)
    zone.tags.extend(HostedZoneTag(key=key, value=value) for key, value in wanted.items())


def update_zone(db: Session, zone_id: str, data: HostedZoneUpdate) -> HostedZone:
    zone = get_zone(db, zone_id)
    vpc_id, vpc_region = _validate_vpc(zone.type, data.vpc_id, data.vpc_region)
    tags = _validate_tags(data.tags)
    if zone.type == "PRIVATE":
        _ensure_unique(db, zone.name, zone.type, vpc_id, exclude_id=zone.id)

    zone.comment = data.comment.strip()
    zone.vpc_id = vpc_id
    zone.vpc_region = vpc_region
    _replace_tags(zone, tags)
    zone.updated_at = utc_now()
    db.commit()
    logger.info("Updated hosted zone %s (%s)", zone.name, zone.id)
    return zone


def delete_zone(db: Session, zone_id: str) -> None:
    zone = get_zone(db, zone_id)
    db.delete(zone)
    db.commit()
    logger.info("Deleted hosted zone %s (%s)", zone.name, zone.id)
