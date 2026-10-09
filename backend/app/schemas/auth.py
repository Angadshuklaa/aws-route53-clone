from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    account_id: str = Field(min_length=1, max_length=64, description="12-digit account ID or alias")
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class CurrentUser(BaseModel):
    username: str
    account_id: str
    session_expires_at: datetime
