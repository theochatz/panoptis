from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Subscription, get_db
from app.api.schemas import SubscriptionIn, SubscriptionOut

router = APIRouter()


@router.post("", response_model=SubscriptionOut, status_code=201)
async def create_subscription(body: SubscriptionIn, db: AsyncSession = Depends(get_db)):
    sub = Subscription(**body.model_dump())
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.get("", response_model=list[SubscriptionOut])
async def list_subscriptions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subscription))
    return result.scalars().all()


@router.patch("/{sub_id}/toggle", response_model=SubscriptionOut)
async def toggle_subscription(sub_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Subscription).where(Subscription.subscription_id == sub_id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscription not found")
    sub.enabled = not sub.enabled
    await db.commit()
    await db.refresh(sub)
    return sub
