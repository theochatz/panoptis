"""
Pydantic response schemas for all API endpoints.

Using explicit response models:
  - Prevents accidental field exposure (e.g. internal columns)
  - Makes the OpenAPI spec accurate and useful
  - Allows FastAPI to validate and serialise output
  - Keeps sensitive fields (raw metadata JSON) out of API responses
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


# ── Shared ────────────────────────────────────────────────────────────────────

class OkResponse(BaseModel):
    ok: bool = True


# ── Subscriptions ─────────────────────────────────────────────────────────────

class SubscriptionIn(BaseModel):
    subscription_id: str
    name: str
    tenant_id: str
    enabled: bool = True

    @field_validator("subscription_id", "tenant_id")
    @classmethod
    def must_look_like_guid(cls, v: str) -> str:
        import re
        if not re.match(
            r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
            v.lower(),
        ):
            raise ValueError("must be a valid GUID")
        return v


class SubscriptionOut(BaseModel):
    id: UUID
    subscription_id: str
    name: str
    tenant_id: str
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Policies ──────────────────────────────────────────────────────────────────

class PolicyIn(BaseModel):
    name: str
    description: Optional[str] = None
    resource_type: str
    category: str
    severity: str = "medium"
    yaml_content: str
    enabled: bool = True
    schedule: Optional[str] = None
    grace_period_hours: int = 72


class PolicyOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    resource_type: str
    category: str
    severity: str
    enabled: bool
    schedule: Optional[str]
    grace_period_hours: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Policy runs ───────────────────────────────────────────────────────────────

class TriggerRunRequest(BaseModel):
    policy_ids: list[str]
    subscription_ids: Optional[list[str]] = None
    parallel: int = 10

    @field_validator("policy_ids", "subscription_ids", mode="before")
    @classmethod
    def validate_uuids(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        for item in v:
            try:
                UUID(item)
            except ValueError:
                raise ValueError(f"'{item}' is not a valid UUID")
        return v


class TriggerRunResponse(BaseModel):
    run_id: str
    task_id: str
    policies: int
    subscriptions: int
    parallel: int
    note: str


class PolicyRunOut(BaseModel):
    id: UUID
    policy_id: UUID
    subscription_id: str
    status: str
    task_id: Optional[str]
    resources_found: int
    estimated_monthly_waste: float
    output: Optional[dict]
    error: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class CancelRunResponse(BaseModel):
    cancelled: bool
    run_id: str


# ── Waste resources ───────────────────────────────────────────────────────────

class WasteResourceOut(BaseModel):
    id: UUID
    run_id: UUID
    subscription_id: str
    resource_id: str
    resource_name: str
    resource_type: str
    resource_group: Optional[str]
    location: Optional[str]
    policy_name: str
    category: str
    severity: Optional[str]
    estimated_monthly_cost: float
    ladder_status: str
    exempt: bool
    first_seen: datetime
    last_seen: datetime

    model_config = {"from_attributes": True}


# ── Remediation actions ───────────────────────────────────────────────────────

class ActionRequest(BaseModel):
    resource_db_id: str
    action_type: str

    @field_validator("resource_db_id")
    @classmethod
    def must_be_uuid(cls, v: str) -> str:
        try:
            UUID(v)
        except ValueError:
            raise ValueError("resource_db_id must be a valid UUID")
        return v

    @field_validator("action_type")
    @classmethod
    def must_be_valid_action(cls, v: str) -> str:
        valid = {"deallocate", "delete", "tag", "snapshot", "tier_down", "resize"}
        if v not in valid:
            raise ValueError(f"action_type must be one of {sorted(valid)}")
        return v


class RemediationActionOut(BaseModel):
    id: UUID
    resource_id: str
    resource_name: Optional[str]
    subscription_id: str
    action_type: str
    status: str
    initiated_by: str
    result: Optional[dict]
    error: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Analytics ─────────────────────────────────────────────────────────────────

class SummaryOut(BaseModel):
    total_identified_waste_monthly: float
    total_realised_savings_monthly: float
    total_waste_resources: int
    runs_last_24h: int
    total_remediation_actions: int


class CategoryBreakdown(BaseModel):
    category: str
    count: int
    total_cost: float


class SubscriptionBreakdown(BaseModel):
    subscription_id: str
    count: int
    total_cost: float


class SeverityBreakdown(BaseModel):
    severity: Optional[str]
    count: int
    total_cost: float


class LadderBreakdown(BaseModel):
    status: Optional[str]
    count: int
    total_cost: float


class RunHistoryPoint(BaseModel):
    day: str
    runs: int
    resources: Optional[int]
    waste: float
