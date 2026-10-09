from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime, utc_now

if TYPE_CHECKING:
    from app.models.hosted_zone import HostedZone


class DnsRecord(Base):
    """A record set: every value sharing one name and type within a zone."""

    __tablename__ = "dns_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    ttl: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utc_now)

    zone: Mapped[HostedZone] = relationship(back_populates="records")
    values: Mapped[list[DnsRecordValue]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="DnsRecordValue.position",
        lazy="selectin",
    )


class DnsRecordValue(Base):
    __tablename__ = "dns_record_values"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("dns_records.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    value: Mapped[str] = mapped_column(String)
    priority: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flags: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tag: Mapped[str | None] = mapped_column(String, nullable=True)
