from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DnsRecord, HostedZone
from app.schemas.dashboard import DashboardSummary, ZoneCounts
from app.services.dns_rules import ALL_RECORD_TYPES
from app.services.hosted_zone_service import to_zone_out

RECENT_ZONE_LIMIT = 5


def get_summary(db: Session) -> DashboardSummary:
    zone_types = dict(db.execute(select(HostedZone.type, func.count()).group_by(HostedZone.type)).all())
    by_type = dict(db.execute(select(DnsRecord.type, func.count()).group_by(DnsRecord.type)).all())
    recent = db.execute(
        select(HostedZone).order_by(HostedZone.created_at.desc(), HostedZone.name).limit(RECENT_ZONE_LIMIT)
    ).scalars()
    return DashboardSummary(
        hosted_zones=ZoneCounts(
            total=sum(zone_types.values()),
            public=zone_types.get("PUBLIC", 0),
            private=zone_types.get("PRIVATE", 0),
        ),
        record_count=sum(by_type.values()),
        records_by_type={record_type: by_type.get(record_type, 0) for record_type in ALL_RECORD_TYPES},
        recent_zones=[to_zone_out(db, zone) for zone in recent],
    )
