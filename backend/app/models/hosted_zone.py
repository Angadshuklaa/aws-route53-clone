from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime, utc_now

if TYPE_CHECKING:
    from app.models.dns_record import DnsRecord


class HostedZone(Base):
    __tablename__ = "hosted_zones"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    comment: Mapped[str] = mapped_column(String, default="")
    vpc_id: Mapped[str | None] = mapped_column(String, nullable=True)
    vpc_region: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    # passive_deletes lets the ON DELETE CASCADE foreign keys do the work.
    records: Mapped[list[DnsRecord]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", passive_deletes=True
    )
    tags: Mapped[list[HostedZoneTag]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="HostedZoneTag.key",
        lazy="selectin",
    )


class HostedZoneTag(Base):
    __tablename__ = "hosted_zone_tags"

    zone_id: Mapped[str] = mapped_column(
        ForeignKey("hosted_zones.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, default="")
