from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

import dns.name
import dns.rdata
import dns.rdataclass
import dns.rdatatype
import dns.ttl
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import utc_now
from app.errors import AppError
from app.models import DnsRecord, HostedZone
from app.schemas.dns_record import RecordValueIn, ZoneImportIssue, ZoneImportResult
from app.services import record_service
from app.services.dns_rules import (
    CREATABLE_RECORD_TYPES,
    format_value,
    normalize_record_name,
    normalize_record_values,
)
from app.services.hosted_zone_service import to_zone_out

logger = logging.getLogger(__name__)

_CLASSES = {"IN", "CH", "HS", "ANY"}


@dataclass
class _LogicalLine:
    number: int
    text: str
    continues_owner: bool


@dataclass
class _ParsedGroup:
    line: int
    name: str
    type: str
    ttl: int
    values: list[RecordValueIn] = field(default_factory=list)


def _logical_lines(content: str) -> list[_LogicalLine]:
    lines: list[_LogicalLine] = []
    buffer: list[str] = []
    start_line = 0
    starts_with_space = False
    depth = 0

    for number, raw in enumerate(content.splitlines(), start=1):
        if depth == 0:
            start_line = number
            starts_with_space = raw[:1] in {" ", "\t"}
        in_quotes = False
        escaped = False
        chars: list[str] = []
        for char in raw:
            if escaped:
                chars.append(char)
                escaped = False
            elif char == "\\":
                chars.append(char)
                escaped = True
            elif char == '"':
                chars.append(char)
                in_quotes = not in_quotes
            elif in_quotes:
                chars.append(char)
            elif char == ";":
                break
            elif char == "(":
                depth += 1
                chars.append(" ")
            elif char == ")":
                depth = max(0, depth - 1)
                chars.append(" ")
            else:
                chars.append(char)
        buffer.append("".join(chars))
        if depth == 0:
            text = " ".join(buffer).strip()
            if text:
                lines.append(_LogicalLine(start_line, text, starts_with_space))
            buffer = []
    if buffer and " ".join(buffer).strip():
        lines.append(_LogicalLine(start_line, " ".join(buffer).strip(), starts_with_space))
    return lines


def _split_first(text: str) -> tuple[str, str]:
    parts = text.split(None, 1)
    return (parts[0], parts[1] if len(parts) > 1 else "")


def _is_ttl(token: str) -> bool:
    try:
        dns.ttl.from_text(token)
        return True
    except Exception:
        return False


def _absolute_name(owner: str, origin: str) -> str:
    if owner == "@":
        return origin
    if owner.endswith("."):
        return owner[:-1]
    return f"{owner}.{origin}"


def _rdata_to_values(record_type: str, rdata: dns.rdata.Rdata) -> RecordValueIn:
    if record_type in {"A", "AAAA"}:
        return RecordValueIn(value=rdata.address)
    if record_type in {"CNAME", "NS", "PTR"}:
        return RecordValueIn(value=rdata.target.to_text())
    if record_type == "MX":
        return RecordValueIn(value=rdata.exchange.to_text(), priority=rdata.preference)
    if record_type == "SRV":
        return RecordValueIn(
            value=rdata.target.to_text(), priority=rdata.priority, weight=rdata.weight, port=rdata.port
        )
    if record_type == "CAA":
        return RecordValueIn(
            value=rdata.value.decode("ascii", "replace"), flags=rdata.flags, tag=rdata.tag.decode("ascii", "replace")
        )
    if record_type == "TXT":
        return RecordValueIn(value=b"".join(rdata.strings).decode("ascii", "replace"))
    raise ValueError(f"Unsupported record type {record_type}")


def parse_zone_file(content: str, zone_name: str) -> tuple[list[_ParsedGroup], list[ZoneImportIssue], list[ZoneImportIssue]]:
    origin = zone_name
    default_ttl: int | None = None
    last_owner: str | None = None
    groups: dict[tuple[str, str], _ParsedGroup] = {}
    skipped: list[ZoneImportIssue] = []
    errors: list[ZoneImportIssue] = []

    for line in _logical_lines(content):
        first, rest = _split_first(line.text)
        directive = first.upper()
        if directive == "$ORIGIN":
            origin = _absolute_name(rest.strip(), origin).lower()
            continue
        if directive == "$TTL":
            try:
                default_ttl = dns.ttl.from_text(rest.strip())
            except Exception:
                errors.append(ZoneImportIssue(line=line.number, message=f"Invalid $TTL value: {rest.strip()}"))
            continue
        if directive.startswith("$"):
            skipped.append(ZoneImportIssue(line=line.number, message=f"The {first} directive isn't supported."))
            continue

        remainder = line.text
        if line.continues_owner:
            if last_owner is None:
                errors.append(ZoneImportIssue(line=line.number, message="The record has no owner name."))
                continue
            owner = last_owner
        else:
            owner, remainder = _split_first(remainder)
            owner = _absolute_name(owner, origin).lower()
            last_owner = owner

        ttl: int | None = None
        record_class = "IN"
        for _ in range(2):
            token, after = _split_first(remainder)
            if token.upper() in _CLASSES:
                record_class = token.upper()
                remainder = after
            elif ttl is None and _is_ttl(token):
                ttl = dns.ttl.from_text(token)
                remainder = after
        record_type, rdata_text = _split_first(remainder)
        record_type = record_type.upper()

        if not record_type:
            errors.append(ZoneImportIssue(line=line.number, message="The record type is missing."))
            continue
        if record_class != "IN":
            skipped.append(ZoneImportIssue(line=line.number, message=f"Only class IN is supported (found {record_class})."))
            continue
        if record_type == "SOA":
            skipped.append(ZoneImportIssue(line=line.number, message="SOA records are managed by Route 53 and were skipped."))
            continue
        if record_type not in CREATABLE_RECORD_TYPES:
            skipped.append(ZoneImportIssue(line=line.number, message=f"Record type {record_type} isn't supported."))
            continue

        try:
            name = normalize_record_name(owner, zone_name)
        except ValueError as exc:
            errors.append(ZoneImportIssue(line=line.number, message=f"{owner}: {exc}"))
            continue
        if record_type == "NS" and name == zone_name:
            skipped.append(
                ZoneImportIssue(line=line.number, message="NS records at the zone apex are managed by Route 53 and were skipped.")
            )
            continue

        try:
            rdata = dns.rdata.from_text(
                dns.rdataclass.IN,
                dns.rdatatype.from_text(record_type),
                rdata_text,
                origin=dns.name.from_text(origin),
                relativize=False,
            )
            value = _rdata_to_values(record_type, rdata)
        except Exception as exc:
            errors.append(ZoneImportIssue(line=line.number, message=f"Invalid {record_type} data for {name}: {exc}"))
            continue

        key = (name, record_type)
        if key not in groups:
            groups[key] = _ParsedGroup(line=line.number, name=name, type=record_type, ttl=ttl or default_ttl or 300)
        groups[key].values.append(value)

    return list(groups.values()), skipped, errors


def import_zone_file(db: Session, zone: HostedZone, content: str, overwrite: bool) -> ZoneImportResult:
    groups, skipped, errors = parse_zone_file(content, zone.name)
    created = updated = 0

    for group in groups:
        try:
            values = normalize_record_values(group.type, group.values)
        except AppError as exc:
            messages = "; ".join(detail["message"] for detail in exc.details) or exc.message
            errors.append(ZoneImportIssue(line=group.line, message=f"{group.name} {group.type}: {messages}"))
            continue

        existing = db.scalar(
            select(DnsRecord).where(
                DnsRecord.zone_id == zone.id, DnsRecord.name == group.name, DnsRecord.type == group.type
            )
        )
        try:
            record_service.check_conflicts(
                db, zone, group.name, group.type, exclude_id=existing.id if existing else None
            )
        except AppError as exc:
            errors.append(ZoneImportIssue(line=group.line, message=exc.message))
            continue

        if existing is not None and not overwrite:
            skipped.append(
                ZoneImportIssue(line=group.line, message=f"{group.name} {group.type} already exists and was left unchanged.")
            )
            continue

        now = utc_now()
        if existing is None:
            record = DnsRecord(zone_id=zone.id, name=group.name, type=group.type, ttl=group.ttl, created_at=now, updated_at=now)
            record_service.apply_values(record, values)
            db.add(record)
            db.flush()
            created += 1
        else:
            existing.ttl = group.ttl
            existing.updated_at = now
            record_service.apply_values(existing, values)
            db.flush()
            updated += 1

    db.commit()
    logger.info("Imported zone file into %s: %d created, %d updated, %d errors", zone.id, created, updated, len(errors))
    return ZoneImportResult(created=created, updated=updated, skipped=skipped, errors=errors)


def _sorted_records(zone: HostedZone) -> list[DnsRecord]:
    type_rank = {"SOA": 0, "NS": 1}
    return sorted(zone.records, key=lambda r: (r.name != zone.name, r.name, type_rank.get(r.type, 2), r.type))


def export_bind(zone: HostedZone) -> str:
    records = _sorted_records(zone)
    lines = [
        f"; Zone file for {zone.name}",
        f"; Hosted zone ID: {zone.id} ({zone.type.lower()})",
        f"; Exported from Route 53 Clone at {utc_now().isoformat(timespec='seconds')}",
        f"$ORIGIN {zone.name}.",
        "$TTL 300",
    ]
    width = max((len(r.name) + 1 for r in records), default=len(zone.name) + 1)
    for record in records:
        for value in record.values:
            rdata = format_value(record.type, value, zone_file=True)
            lines.append(f"{record.name + '.':<{width}}  {record.ttl:<7} IN  {record.type:<5} {rdata}")
    return "\n".join(lines) + "\n"


def export_json(db: Session, zone: HostedZone) -> str:
    document = {
        "hosted_zone": to_zone_out(db, zone).model_dump(mode="json"),
        "records": [
            record_service.to_record_out(record, zone).model_dump(mode="json") for record in _sorted_records(zone)
        ],
        "exported_at": utc_now().isoformat(timespec="seconds"),
    }
    return json.dumps(document, indent=2) + "\n"
