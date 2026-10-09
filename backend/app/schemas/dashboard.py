from __future__ import annotations

from pydantic import BaseModel

from app.schemas.hosted_zone import HostedZoneOut


class ZoneCounts(BaseModel):
    total: int
    public: int
    private: int


class DashboardSummary(BaseModel):
    hosted_zones: ZoneCounts
    record_count: int
    records_by_type: dict[str, int]
    recent_zones: list[HostedZoneOut]
