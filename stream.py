from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Policy, get_db
from app.api.schemas import PolicyIn, PolicyOut

router = APIRouter()


def _get_policy_or_404(policy_id: str) -> UUID:
    """Validate and parse a UUID path parameter, raising 422 on bad input."""
    try:
        return UUID(policy_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="policy_id must be a valid UUID")


@router.get("", response_model=list[PolicyOut])
async def list_policies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy))
    return result.scalars().all()


@router.post("", response_model=PolicyOut, status_code=201)
async def create_policy(body: PolicyIn, db: AsyncSession = Depends(get_db)):
    policy = Policy(**body.model_dump())
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.get("/{policy_id}", response_model=PolicyOut)
async def get_policy(policy_id: str, db: AsyncSession = Depends(get_db)):
    uid = _get_policy_or_404(policy_id)
    result = await db.execute(select(Policy).where(Policy.id == uid))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Policy not found")
    return p


@router.put("/{policy_id}", response_model=PolicyOut)
async def update_policy(policy_id: str, body: PolicyIn, db: AsyncSession = Depends(get_db)):
    uid = _get_policy_or_404(policy_id)
    result = await db.execute(select(Policy).where(Policy.id == uid))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Policy not found")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return p


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(policy_id: str, db: AsyncSession = Depends(get_db)):
    uid = _get_policy_or_404(policy_id)
    result = await db.execute(select(Policy).where(Policy.id == uid))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Policy not found")
    await db.delete(p)
    await db.commit()


@router.patch("/{policy_id}/toggle", response_model=PolicyOut)
async def toggle_policy(policy_id: str, db: AsyncSession = Depends(get_db)):
    uid = _get_policy_or_404(policy_id)
    result = await db.execute(select(Policy).where(Policy.id == uid))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Policy not found")
    p.enabled = not p.enabled
    await db.commit()
    await db.refresh(p)
    return p
