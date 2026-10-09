from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.dns_rules import normalize_zone_name

ZoneType = Literal["PUBLIC", "PRIVATE"]


class Tag(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(default="", max_length=256)

    @field_validator("key")
    @classmethod
    def _key_not_reserved(cls, key: str) -> str:
        key = key.strip()
        if not key:
            raise ValueError("Enter a tag key.")
        if key.lower().startswith("aws:"):
            raise ValueError('Tag keys can\'t start with "aws:".')
        return key


class _ZoneWritable(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: str = Field(default="", max_length=256)
    vpc_id: str | None = Field(default=None, max_length=32)
    vpc_region: str | None = Field(default=None, max_length=32)
    tags: list[Tag] = Field(default_factory=list, max_length=50)


class HostedZoneCreate(_ZoneWritable):
    name: str = Field(max_length=255, examples=["example.com"])
    type: ZoneType = "PUBLIC"

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, name: str) -> str:
        return normalize_zone_name(name)


class HostedZoneUpdate(_ZoneWritable):
    """Replaces the editable fields. The domain name and type can't be changed."""


class HostedZoneOut(BaseModel):
    id: str
    name: str
    type: ZoneType
    comment: str
    vpc_id: str | None
    vpc_region: str | None
    record_count: int
    name_servers: list[str]
    tags: list[Tag]
    created_at: datetime
    updated_at: datetime
