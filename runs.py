from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import PolicyRun, RemediationAction, WasteResource, get_db
from app.api.schemas import (
    CategoryBreakdown, LadderBreakdown, RunHistoryPoint,
    SeverityBreakdown, SubscriptionBreakdown, SummaryOut,
)

router = APIRouter()


@router.get("/summary", response_model=SummaryOut)
async def get_summary(db: AsyncSession = Depends(get_db)):
    total_waste = (await db.execute(
        select(func.sum(WasteResource.estimated_monthly_cost))
        .where(WasteResource.exempt == False)
    )).scalar()
    realised = (await db.execute(
        select(func.sum(WasteResource.estimated_monthly_cost))
        .where(WasteResource.ladder_status.in_(["deallocated", "deleted", "resized", "tiered_down"]))
    )).scalar()
    total_resources = (await db.execute(
        select(func.count(WasteResource.id)).where(WasteResource.exempt == False)
    )).scalar()
    runs_today = (await db.execute(
        select(func.count(PolicyRun.id))
        .where(text("created_at > now() - interval '24 hours'"))
    )).scalar()
    actions_total = (await db.execute(select(func.count(RemediationAction.id)))).scalar()

    return SummaryOut(
        total_identified_waste_monthly=round(total_waste or 0, 2),
        total_realised_savings_monthly=round(realised or 0, 2),
        total_waste_resources=total_resources or 0,
        runs_last_24h=runs_today or 0,
        total_remediation_actions=actions_total or 0,
    )


@router.get("/by-category", response_model=list[CategoryBreakdown])
async def waste_by_category(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WasteResource.category,
               func.count(WasteResource.id).label("count"),
               func.sum(WasteResource.estimated_monthly_cost).label("total_cost"))
        .where(WasteResource.exempt == False)
        .group_by(WasteResource.category)
        .order_by(func.sum(WasteResource.estimated_monthly_cost).desc())
    )
    return [CategoryBreakdown(category=r[0], count=r[1], total_cost=round(r[2] or 0, 2))
            for r in result.all()]


@router.get("/by-subscription", response_model=list[SubscriptionBreakdown])
async def waste_by_subscription(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WasteResource.subscription_id,
               func.count(WasteResource.id).label("count"),
               func.sum(WasteResource.estimated_monthly_cost).label("total_cost"))
        .where(WasteResource.exempt == False)
        .group_by(WasteResource.subscription_id)
        .order_by(func.sum(WasteResource.estimated_monthly_cost).desc())
    )
    return [SubscriptionBreakdown(subscription_id=r[0], count=r[1], total_cost=round(r[2] or 0, 2))
            for r in result.all()]


@router.get("/by-severity", response_model=list[SeverityBreakdown])
async def waste_by_severity(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WasteResource.severity,
               func.count(WasteResource.id).label("count"),
               func.sum(WasteResource.estimated_monthly_cost).label("total_cost"))
        .where(WasteResource.exempt == False)
        .group_by(WasteResource.severity)
    )
    return [SeverityBreakdown(severity=r[0], count=r[1], total_cost=round(r[2] or 0, 2))
            for r in result.all()]


@router.get("/ladder-breakdown", response_model=list[LadderBreakdown])
async def ladder_breakdown(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WasteResource.ladder_status,
               func.count(WasteResource.id).label("count"),
               func.sum(WasteResource.estimated_monthly_cost).label("total_cost"))
        .group_by(WasteResource.ladder_status)
    )
    return [LadderBreakdown(status=r[0], count=r[1], total_cost=round(r[2] or 0, 2))
            for r in result.all()]


@router.get("/run-history", response_model=list[RunHistoryPoint])
async def run_history(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    # days parameter is validated by Query — no f-string injection risk
    result = await db.execute(text(
        "SELECT DATE(created_at) as day, COUNT(*) as runs, "
        "SUM(resources_found) as resources, SUM(estimated_monthly_waste) as waste "
        "FROM policy_runs "
        "WHERE created_at > now() - (:days || ' days')::interval AND status = 'completed' "
        "GROUP BY DATE(created_at) ORDER BY day"
    ), {"days": days})
    return [RunHistoryPoint(day=str(r[0]), runs=r[1], resources=r[2], waste=round(float(r[3] or 0), 2))
            for r in result.all()]
