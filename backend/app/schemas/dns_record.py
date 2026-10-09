from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CreatableRecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"]
RecordType = Literal["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"]


class RecordValueIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str = Field(default="", max_length=4096)
    priority: int | None = None
    weight: int | None = None
    port: int | None = None
    flags: int | None = None
    tag: str | None = Field(default=None, max_length=32)


class RecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=255, examples=["www.example.com"])
    type: CreatableRecordType
    ttl: int = Field(default=300)
    values: list[RecordValueIn] = Field(max_length=100)


class RecordUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=255)
    type: RecordType
    ttl: int
    values: list[RecordValueIn] = Field(max_length=100)


class RecordValueOut(BaseModel):
    value: str
    priority: int | None = None
    weight: int | None = None
    port: int | None = None
    flags: int | None = None
    tag: str | None = None


class RecordOut(BaseModel):
    id: int
    zone_id: str
    name: str
    type: RecordType
    ttl: int
    values: list[RecordValueOut]
    formatted_values: list[str] = Field(description="Values rendered as Route 53 displays them")
    routing_policy: Literal["SIMPLE"] = "SIMPLE"
    is_system: bool = Field(description="Apex NS/SOA records that Route 53 manages and that can't be deleted")
    created_at: datetime
    updated_at: datetime


class BulkDeleteRequest(BaseModel):
    record_ids: list[int] = Field(min_length=1, max_length=500)


class BulkDeleteFailure(BaseModel):
    id: int
    message: str


class BulkDeleteResult(BaseModel):
    deleted: list[int]
    failed: list[BulkDeleteFailure]


class ZoneImportRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1_000_000, description="BIND zone file text")
    overwrite: bool = Field(default=False, description="Replace record sets that already exist")


class ZoneImportIssue(BaseModel):
    line: int
    message: str


class ZoneImportResult(BaseModel):
    created: int
    updated: int
    skipped: list[ZoneImportIssue]
    errors: list[ZoneImportIssue]
