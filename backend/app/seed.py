from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.database import utc_now
from app.models import AppMetadata, HostedZone
from app.schemas.dns_record import RecordCreate, RecordValueIn
from app.schemas.hosted_zone import HostedZoneCreate, Tag
from app.services import hosted_zone_service, record_service

logger = logging.getLogger(__name__)

SEED_MARKER = "demo_data_seeded_at"

DEMO_ZONES: list[tuple] = [
    (
        "example.com", "PUBLIC", "Primary production domain", None,
        [("Environment", "production"), ("Owner", "platform-team")],
        [
            ("@", "A", 300, ["192.0.2.10", "192.0.2.11"]),
            ("@", "AAAA", 300, ["2001:db8::10"]),
            ("@", "MX", 3600, [{"priority": 10, "value": "mail.example.com"}, {"priority": 20, "value": "mail2.example.com"}]),
            ("@", "TXT", 3600, ["v=spf1 include:_spf.example.com ~all", "google-site-verification=6Ttq2Lq9Xc0Qd3"]),
            ("@", "CAA", 3600, [
                {"flags": 0, "tag": "issue", "value": "amazon.com"},
                {"flags": 0, "tag": "issuewild", "value": ";"},
                {"flags": 0, "tag": "iodef", "value": "mailto:security@example.com"},
            ]),
            ("www", "CNAME", 300, ["example.com"]),
            ("api", "A", 60, ["198.51.100.20", "198.51.100.21"]),
            ("api", "AAAA", 60, ["2001:db8::20"]),
            ("app", "CNAME", 300, ["d111111abcdef8.cloudfront.net"]),
            ("mail", "A", 3600, ["192.0.2.25"]),
            ("mail2", "A", 3600, ["192.0.2.26"]),
            ("sip", "A", 3600, ["192.0.2.40"]),
            ("xmpp", "A", 3600, ["192.0.2.41"]),
            ("_sip._tcp", "SRV", 3600, [{"priority": 10, "weight": 60, "port": 5060, "value": "sip.example.com"}]),
            ("_xmpp-server._tcp", "SRV", 3600, [
                {"priority": 5, "weight": 0, "port": 5269, "value": "xmpp.example.com"},
                {"priority": 10, "weight": 0, "port": 5269, "value": "xmpp-backup.example.net"},
            ]),
            ("_dmarc", "TXT", 3600, ["v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@example.com"]),
            ("selector1._domainkey", "TXT", 3600, [
                "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDwIRP/UC3SBsEmGqZ9ZJW3/DkMoGeLnQg1fWn7/zYt"
            ]),
            ("dev", "NS", 172800, ["ns-1.example.net", "ns-2.example.net"]),
            ("*.preview", "A", 300, ["203.0.113.50"]),
            ("status", "CNAME", 300, ["status.example.net"]),
            ("vpn", "A", 300, ["203.0.113.10"]),
            ("docs", "CNAME", 300, ["www.example.org"]),
        ],
    ),
    (
        "example.net", "PUBLIC", "Marketing website", None, [("Environment", "production")],
        [
            ("@", "A", 300, ["198.51.100.80"]),
            ("www", "CNAME", 300, ["example.net"]),
            ("@", "MX", 3600, [{"priority": 10, "value": "mail.example.com"}]),
            ("@", "TXT", 3600, ["v=spf1 -all"]),
            ("ns-1", "A", 3600, ["198.51.100.53"]),
            ("ns-2", "A", 3600, ["198.51.100.54"]),
        ],
    ),
    (
        "example.org", "PUBLIC", "Open source project documentation", None, [],
        [
            ("@", "A", 300, ["203.0.113.80"]),
            ("www", "A", 300, ["203.0.113.80"]),
            ("@", "CAA", 86400, [{"flags": 0, "tag": "issue", "value": "letsencrypt.org"}]),
        ],
    ),
    (
        "2.0.192.in-addr.arpa", "PUBLIC", "Reverse DNS for 192.0.2.0/24", None, [("Purpose", "reverse-dns")],
        [
            ("10", "PTR", 3600, ["example.com"]),
            ("11", "PTR", 3600, ["example.com"]),
            ("25", "PTR", 3600, ["mail.example.com"]),
            ("40", "PTR", 3600, ["sip.example.com"]),
        ],
    ),
    (
        "staging.example.com", "PUBLIC", "Staging environment", None, [("Environment", "staging")],
        [
            ("@", "A", 60, ["198.51.100.120"]),
            ("api", "CNAME", 60, ["staging.example.com"]),
        ],
    ),
    (
        "corp.internal", "PRIVATE", "Internal corporate services", ("vpc-0a1b2c3d4e5f67890", "us-east-1"),
        [("Environment", "corporate")],
        [
            ("git", "A", 300, ["10.0.1.10"]),
            ("wiki", "A", 300, ["10.0.1.11"]),
            ("ci", "A", 300, ["10.0.1.12"]),
            ("ldap", "A", 300, ["10.0.2.5"]),
            ("_ldap._tcp", "SRV", 300, [{"priority": 0, "weight": 100, "port": 389, "value": "ldap.corp.internal"}]),
        ],
    ),
    (
        "db.internal", "PRIVATE", "Database endpoints", ("vpc-0f9e8d7c6b5a43210", "eu-west-1"), [],
        [
            ("primary", "A", 60, ["10.20.0.10"]),
            ("replica", "A", 60, ["10.20.0.11", "10.20.0.12"]),
            ("writer", "CNAME", 60, ["primary.db.internal"]),
        ],
    ),
    (
        "shop.example", "PUBLIC", "E-commerce storefront", None, [("Team", "commerce")],
        [
            ("@", "A", 300, ["203.0.113.120"]),
            ("@", "AAAA", 300, ["2001:db8:5::120"]),
            ("@", "MX", 3600, [{"priority": 5, "value": "mx.shop.example"}]),
            ("mx", "A", 3600, ["203.0.113.125"]),
        ],
    ),
    ("blog.example", "PUBLIC", "Company blog", None, [], [("@", "A", 300, ["198.51.100.200"])]),
    ("dev.test", "PUBLIC", "Developer sandbox", None, [("Environment", "development")], []),
    ("cdn.example.net", "PUBLIC", "CDN delegation", None, [], [("assets", "CNAME", 300, ["d222222abcdef8.cloudfront.net"])]),
    ("mail.example.org", "PUBLIC", "", None, [], [("@", "MX", 3600, [{"priority": 10, "value": "mx1.example.org"}])]),
]


def _value(raw: str | dict) -> RecordValueIn:
    return RecordValueIn(value=raw) if isinstance(raw, str) else RecordValueIn(**raw)


def _seed(db: Session) -> None:
    for name, zone_type, comment, vpc, tags, records in DEMO_ZONES:
        zone = hosted_zone_service.create_zone(
            db,
            HostedZoneCreate(
                name=name,
                type=zone_type,
                comment=comment,
                vpc_id=vpc[0] if vpc else None,
                vpc_region=vpc[1] if vpc else None,
                tags=[Tag(key=key, value=value) for key, value in tags],
            ),
        )
        for prefix, record_type, ttl, values in records:
            record_name = name if prefix == "@" else f"{prefix}.{name}"
            record_service.create_record(
                db,
                zone,
                RecordCreate(name=record_name, type=record_type, ttl=ttl, values=[_value(v) for v in values]),
            )


def seed_demo_data(session_factory: sessionmaker[Session]) -> bool:
    with session_factory() as db:
        if db.get(AppMetadata, SEED_MARKER) is not None:
            return False
        has_data = (db.scalar(select(func.count(HostedZone.id))) or 0) > 0
        if not has_data:
            _seed(db)
            logger.info("Seeded demo data (%d hosted zones)", len(DEMO_ZONES))
        db.add(AppMetadata(key=SEED_MARKER, value=utc_now().isoformat()))
        db.commit()
        return not has_data
