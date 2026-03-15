from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import RemediationAction, WasteResource, get_db
from app.api.schemas import ActionRequest, RemediationActionOut
from app.workers.tasks import apply_remediation

router = APIRouter()


@router.post("", response_model=RemediationActionOut, status_code=201)
async def trigger_action(body: ActionRequest, db: AsyncSession = Depends(get_db)):
    # UUID already validated by Pydantic schema
    from uuid import UUID
    result = await db.execute(
        select(WasteResource).where(WasteResource.id == UUID(body.resource_db_id))
    )
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(404, "Resource not found")

    action = RemediationAction(
        resource_id=resource.resource_id,
        resource_name=resource.resource_name,
        subscription_id=resource.subscription_id,
        action_type=body.action_type,
        initiated_by="manual",
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    apply_remediation.apply_async(
        args=[str(action.id), resource.resource_id, resource.subscription_id,
              body.action_type, resource.resource_name],
        queue="remediation",
    )
    return action


@router.get("", response_model=list[RemediationActionOut])
async def list_actions(limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RemediationAction)
        .order_by(desc(RemediationAction.created_at))
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


@router.get("/{action_id}", response_model=RemediationActionOut)
async def get_action(action_id: str, db: AsyncSession = Depends(get_db)):
    from uuid import UUID
    try:
        uid = UUID(action_id)
    except ValueError:
        raise HTTPException(422, "action_id must be a valid UUID")
    result = await db.execute(select(RemediationAction).where(RemediationAction.id == uid))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Action not found")
    return a
