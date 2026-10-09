"""DNS naming rules plus per-type validation and formatting of record values.

These rules are intentionally pragmatic: they reject clearly invalid input
without implementing every corner of the DNS RFCs.
"""

from __future__ import annotations

import hashlib
import ipaddress
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from app.errors import FieldValidationError

CREATABLE_RECORD_TYPES = ("A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA")
ALL_RECORD_TYPES = (*CREATABLE_RECORD_TYPES, "SOA")
CAA_TAGS = ("issue", "issuewild", "issuemail", "iodef")
MAX_TTL = 2_147_483_647
MAX_TXT_LENGTH = 4000
MAX_CAA_VALUE_LENGTH = 1024

_ZONE_LABEL = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
# Record names and targets may also contain underscores (e.g. _sip._tcp, DKIM selectors).
_HOST_LABEL = re.compile(r"^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$")
_PRINTABLE_ASCII = re.compile(r"^[\x20-\x7e]*$")


def _strip_trailing_dot(value: str) -> str:
    value = value.strip().lower()
    return value[:-1] if value.endswith(".") else value


def _check_labels(labels: list[str], pattern: re.Pattern[str], allow_leading_wildcard: bool) -> None:
    for index, label in enumerate(labels):
        if label == "*" and allow_leading_wildcard and index == 0:
            continue
        if label == "*":
            raise ValueError("A wildcard (*) is allowed only as the leftmost label.")
        if not label:
            raise ValueError("The name can't contain empty labels (two dots in a row).")
        if len(label) > 63:
            raise ValueError("Each label must be 63 characters or fewer.")
        if not pattern.match(label):
            raise ValueError(
                f'"{label}" isn\'t a valid label. Use letters, numbers, hyphens and underscores, '
                "and don't start or end a label with a hyphen."
            )


def normalize_zone_name(value: str) -> str:
    name = _strip_trailing_dot(value)
    if not name:
        raise ValueError("Enter a domain name.")
    if len(name) > 253:
        raise ValueError("The domain name must be 253 characters or fewer.")
    labels = name.split(".")
    if any(not label for label in labels):
        raise ValueError("The domain name can't contain empty labels (two dots in a row).")
    for label in labels:
        if len(label) > 63:
            raise ValueError("Each label in the domain name must be 63 characters or fewer.")
        if not _ZONE_LABEL.match(label):
            raise ValueError(
                f'"{label}" isn\'t a valid label. Use letters, numbers and hyphens, '
                "and don't start or end a label with a hyphen."
            )
    if len(labels) < 2:
        raise ValueError("Enter a fully qualified domain name, such as example.com.")
    if labels[-1].isdigit():
        raise ValueError("The top-level domain can't be numeric.")
    return name


def normalize_record_name(value: str, zone_name: str) -> str:
    name = _strip_trailing_dot(value)
    if not name:
        raise ValueError("Enter a record name.")
    if name != zone_name and not name.endswith("." + zone_name):
        raise ValueError(f"The record name must be {zone_name} or a subdomain of {zone_name}.")
    if len(name) > 253:
        raise ValueError("The record name must be 253 characters or fewer.")
    _check_labels(name.split("."), _HOST_LABEL, allow_leading_wildcard=True)
    return name


def normalize_hostname(value: str) -> str:
    host = _strip_trailing_dot(value)
    if not host:
        raise ValueError("Enter a domain name.")
    if len(host) > 253:
        raise ValueError("The domain name must be 253 characters or fewer.")
    labels = host.split(".")
    _check_labels(labels, _HOST_LABEL, allow_leading_wildcard=False)
    if all(label.isdigit() for label in labels):
        raise ValueError("Enter a domain name, not an IP address.")
    return host


class RecordValueInput(Protocol):
    value: str
    priority: int | None
    weight: int | None
    port: int | None
    flags: int | None
    tag: str | None


@dataclass(frozen=True)
class NormalizedValue:
    value: str
    priority: int | None = None
    weight: int | None = None
    port: int | None = None
    flags: int | None = None
    tag: str | None = None


class _Errors:
    def __init__(self) -> None:
        self.items: list[dict[str, str]] = []

    def add(self, field: str, message: str) -> None:
        self.items.append({"field": field, "message": message})


def _int_field(
    item: RecordValueInput, attr: str, label: str, low: int, high: int, prefix: str, errors: _Errors
) -> int | None:
    raw = getattr(item, attr)
    if raw is None:
        errors.add(f"{prefix}.{attr}", f"Enter a {label}.")
        return None
    if not low <= raw <= high:
        errors.add(f"{prefix}.{attr}", f"{label.capitalize()} must be between {low} and {high}.")
        return None
    return raw


def _hostname_field(raw: str, prefix: str, errors: _Errors, allow_root: bool = False) -> str | None:
    if allow_root and raw.strip() == ".":
        return "."
    try:
        return normalize_hostname(raw)
    except ValueError as exc:
        errors.add(f"{prefix}.value", str(exc))
        return None


def _normalize_soa(raw: str, prefix: str, errors: _Errors) -> str | None:
    parts = raw.split()
    if len(parts) != 7:
        errors.add(
            f"{prefix}.value",
            "An SOA value has 7 fields: primary name server, admin email, serial, refresh, retry, "
            "expire and minimum TTL.",
        )
        return None
    try:
        mname, rname = (normalize_hostname(part) for part in parts[:2])
    except ValueError as exc:
        errors.add(f"{prefix}.value", str(exc))
        return None
    numbers = parts[2:]
    if not all(n.isdigit() and int(n) <= 4_294_967_295 for n in numbers):
        errors.add(f"{prefix}.value", "Serial, refresh, retry, expire and minimum TTL must be whole numbers.")
        return None
    return " ".join([f"{mname}.", f"{rname}.", *(str(int(n)) for n in numbers)])


def _normalize_one(record_type: str, item: RecordValueInput, prefix: str, errors: _Errors) -> NormalizedValue | None:
    raw = item.value if item.value is not None else ""
    before = len(errors.items)

    if record_type in {"A", "AAAA"}:
        address_type = ipaddress.IPv4Address if record_type == "A" else ipaddress.IPv6Address
        try:
            address = address_type(raw.strip())
        except ValueError:
            kind = "IPv4 address, such as 192.0.2.44" if record_type == "A" else "IPv6 address, such as 2001:db8::1"
            errors.add(f"{prefix}.value", f"Enter a valid {kind}.")
            return None
        return NormalizedValue(value=str(address))

    if record_type in {"CNAME", "NS", "PTR"}:
        host = _hostname_field(raw, prefix, errors)
        return NormalizedValue(value=host) if host else None

    if record_type == "TXT":
        if raw == "":
            errors.add(f"{prefix}.value", "Enter a text value.")
        elif len(raw) > MAX_TXT_LENGTH:
            errors.add(f"{prefix}.value", f"A TXT value can have up to {MAX_TXT_LENGTH} characters.")
        elif not _PRINTABLE_ASCII.match(raw):
            errors.add(f"{prefix}.value", "TXT values can contain only printable ASCII characters (no line breaks).")
        return NormalizedValue(value=raw) if len(errors.items) == before else None

    if record_type == "MX":
        priority = _int_field(item, "priority", "priority", 0, 65535, prefix, errors)
        host = _hostname_field(raw, prefix, errors)
        if len(errors.items) != before:
            return None
        return NormalizedValue(value=host or "", priority=priority)

    if record_type == "SRV":
        priority = _int_field(item, "priority", "priority", 0, 65535, prefix, errors)
        weight = _int_field(item, "weight", "weight", 0, 65535, prefix, errors)
        port = _int_field(item, "port", "port", 0, 65535, prefix, errors)
        host = _hostname_field(raw, prefix, errors, allow_root=True)
        if len(errors.items) != before:
            return None
        return NormalizedValue(value=host or "", priority=priority, weight=weight, port=port)

    if record_type == "CAA":
        flags = _int_field(item, "flags", "flag", 0, 255, prefix, errors)
        tag = (item.tag or "").strip().lower()
        if tag not in CAA_TAGS:
            errors.add(f"{prefix}.tag", f"Choose a tag: {', '.join(CAA_TAGS)}.")
        value = raw.strip()
        if not value:
            errors.add(f"{prefix}.value", "Enter a value, such as amazon.com.")
        elif len(value) > MAX_CAA_VALUE_LENGTH or not _PRINTABLE_ASCII.match(value):
            errors.add(f"{prefix}.value", "The CAA value must be printable ASCII text.")
        elif tag == "iodef" and not value.startswith(("mailto:", "http://", "https://")):
            errors.add(f"{prefix}.value", "An iodef value must be a mailto:, http:// or https:// URL.")
        if len(errors.items) != before:
            return None
        return NormalizedValue(value=value, flags=flags, tag=tag)

    if record_type == "SOA":
        soa = _normalize_soa(raw, prefix, errors)
        return NormalizedValue(value=soa) if soa else None

    errors.add("type", f"Unsupported record type {record_type}.")
    return None


def normalize_record_values(record_type: str, values: Sequence[RecordValueInput]) -> list[NormalizedValue]:
    errors = _Errors()
    if not values:
        errors.add("values", "Enter at least one value.")
    elif record_type in {"CNAME", "SOA"} and len(values) > 1:
        errors.add("values", f"A {record_type} record can have only one value.")

    normalized: list[NormalizedValue | None] = [
        _normalize_one(record_type, item, f"values[{index}]", errors) for index, item in enumerate(values)
    ]

    seen: set[NormalizedValue] = set()
    for index, item in enumerate(normalized):
        if item is None:
            continue
        if item in seen:
            errors.add(f"values[{index}].value", "Duplicate value. Each value in a record must be unique.")
        seen.add(item)

    if errors.items:
        raise FieldValidationError(errors.items)
    return [item for item in normalized if item is not None]


def validate_ttl(ttl: int) -> None:
    if not 0 <= ttl <= MAX_TTL:
        raise FieldValidationError([{"field": "ttl", "message": f"TTL must be between 0 and {MAX_TTL} seconds."}])


def quote_txt(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _absolute(host: str) -> str:
    return host if host.endswith(".") else f"{host}."


def format_value(record_type: str, item: NormalizedValue | RecordValueInput, zone_file: bool = False) -> str:
    """Render a value the way Route 53 displays it (or as zone-file RDATA)."""
    host = (lambda h: _absolute(h)) if zone_file else (lambda h: h)
    if record_type == "MX":
        return f"{item.priority} {host(item.value)}"
    if record_type == "SRV":
        return f"{item.priority} {item.weight} {item.port} {host(item.value)}"
    if record_type == "CAA":
        return f"{item.flags} {item.tag} {quote_txt(item.value)}"
    if record_type == "TXT":
        if zone_file and len(item.value) > 255:
            # A single DNS character-string holds at most 255 bytes.
            chunks = [item.value[i : i + 255] for i in range(0, len(item.value), 255)]
            return " ".join(quote_txt(chunk) for chunk in chunks)
        return quote_txt(item.value)
    if record_type in {"CNAME", "NS", "PTR"}:
        return host(item.value)
    return item.value


def generate_name_servers(zone_id: str, private: bool) -> list[str]:
    """Deterministic awsdns-style delegation set for a zone."""
    if private:
        return ["ns-0.awsdns-00.com", "ns-512.awsdns-00.net", "ns-1024.awsdns-00.org", "ns-1536.awsdns-00.co.uk"]
    digest = hashlib.sha256(zone_id.encode()).digest()
    servers = []
    for index, tld in enumerate(("com", "net", "org", "co.uk")):
        number = index * 512 + digest[index * 2] * 2 % 512
        group = digest[index * 2 + 1] % 64
        servers.append(f"ns-{number}.awsdns-{group:02d}.{tld}")
    return servers
