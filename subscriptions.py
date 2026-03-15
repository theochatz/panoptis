from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import WasteResource, get_db
from app.api.schemas import WasteResourceOut

router = APIRouter()


@router.get("", response_model=list[WasteResourceOut])
async def list_resources(
    subscription_id: Optional[str] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    ladder_status: Optional[str] = None,
    exempt: Optional[bool] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    q = select(WasteResource).order_by(desc(WasteResource.estimated_monthly_cost))
    if subscription_id: q = q.where(WasteResource.subscription_id == subscription_id)
    if category:        q = q.where(WasteResource.category == category)
    if severity:        q = q.where(WasteResource.severity == severity)
    if ladder_status:   q = q.where(WasteResource.ladder_status == ladder_status)
    if exempt is not None: q = q.where(WasteResource.exempt == exempt)
    result = await db.execute(q.limit(limit).offset(offset))
    return result.scalars().all()


@router.patch("/{resource_db_id}/exempt", response_model=WasteResourceOut)
async def toggle_exempt(resource_db_id: str, db: AsyncSession = Depends(get_db)):
    try:
        uid = UUID(resource_db_id)
    except ValueError:
        raise HTTPException(422, "resource_db_id must be a valid UUID")
    result = await db.execute(select(WasteResource).where(WasteResource.id == uid))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Resource not found")
    r.exempt = not r.exempt
    r.ladder_status = "exempt" if r.exempt else "notify"
    await db.commit()
    await db.refresh(r)
    return r
