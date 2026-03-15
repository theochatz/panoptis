"""Runs router — triggers c7n-org sweeps and tracks execution status."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Policy, PolicyRun, Subscription, get_db
from app.api.schemas import (
    CancelRunResponse, PolicyRunOut, TriggerRunRequest, TriggerRunResponse,
)
from app.workers.tasks import celery_app, run_policy_set

router = APIRouter()


@router.post("/trigger", response_model=TriggerRunResponse)
async def trigger_runs(body: TriggerRunRequest, db: AsyncSession = Depends(get_db)):
    """
    Dispatch a single c7n-org sweep for N policies x M subscriptions.
    UUIDs in the request body are validated by the Pydantic schema.
    """
    subs_q = select(Subscription).where(Subscription.enabled == True)
    if body.subscription_ids:
        subs_q = subs_q.where(Subscription.subscription_id.in_(body.subscription_ids))
    subs = (await db.execute(subs_q)).scalars().all()
    if not subs:
        raise HTTPException(400, "No enabled subscriptions found")

    policies = []
    for pid in body.policy_ids:
        p = (await db.execute(select(Policy).where(Policy.id == UUID(pid)))).scalar_one_or_none()
        if p:
            policies.append(p)
    if not policies:
        raise HTTPException(400, "No valid policies found for the given IDs")

    policy_dicts = [
        {"id": str(p.id), "name": p.name, "yaml_content": p.yaml_content,
         "category": p.category, "severity": p.severity, "resource_type": p.resource_type}
        for p in policies
    ]
    sub_dicts = [
        {"subscription_id": s.subscription_id, "name": s.name,
         "tenant_id": s.tenant_id, "environment": ""}
        for s in subs
    ]

    import uuid
    run_uuid = uuid.uuid4()
    run_id = str(run_uuid)
    run = PolicyRun(
        id=run_uuid,
        policy_id=policies[0].id,
        subscription_id="multi-subscription",
        status="pending",
    )
    db.add(run)
    await db.commit()

    parallel = min(body.parallel, len(subs))
    task = run_policy_set.apply_async(
        args=[run_id, policy_dicts, sub_dicts],
        kwargs={"parallel": parallel},
        queue="policy-runs",
    )

    return TriggerRunResponse(
        run_id=run_id,
        task_id=task.id,
        policies=len(policies),
        subscriptions=len(subs),
        parallel=parallel,
        note=f"1 c7n-org task dispatched covering {len(policies)} policies x {len(subs)} subscriptions",
    )


@router.get("", response_model=list[PolicyRunOut])
async def list_runs(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PolicyRun).order_by(desc(PolicyRun.created_at)).limit(limit).offset(offset)
    )
    return result.scalars().all()


@router.get("/{run_id}", response_model=PolicyRunOut)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    try:
        uid = UUID(run_id)
    except ValueError:
        raise HTTPException(422, "run_id must be a valid UUID")
    result = await db.execute(select(PolicyRun).where(PolicyRun.id == uid))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@router.delete("/{run_id}/cancel", response_model=CancelRunResponse)
async def cancel_run(run_id: str, db: AsyncSession = Depends(get_db)):
    try:
        uid = UUID(run_id)
    except ValueError:
        raise HTTPException(422, "run_id must be a valid UUID")
    result = await db.execute(select(PolicyRun).where(PolicyRun.id == uid))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    if run.task_id:
        celery_app.control.revoke(run.task_id, terminate=True, signal="SIGTERM")
    run.status = "cancelled"
    await db.commit()
    return CancelRunResponse(cancelled=True, run_id=run_id)
