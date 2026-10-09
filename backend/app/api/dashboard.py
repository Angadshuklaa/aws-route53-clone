from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_session
from app.schemas.common import ERROR_RESPONSES
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(require_session)],
    responses=ERROR_RESPONSES,
)


@router.get("", response_model=DashboardSummary)
def get_dashboard(db: DbSession) -> DashboardSummary:
    """Counts of hosted zones and records, plus the most recently created zones."""
    return dashboard_service.get_summary(db)
