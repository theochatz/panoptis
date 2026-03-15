"""
Database engine, models, and init.

Design decisions:
  - All timestamps use datetime.now(timezone.utc) — utcnow() is deprecated in Python 3.12
  - server_default=func.now() lets Postgres set timestamps, not the application clock
  - JSON columns use default=dict (callable) not default={} (mutable shared instance)
  - __table_args__ defines indexes on all frequently-filtered columns
  - Connection pool configured with pre-ping for resilience under HPA scaling
  - No hardcoded credentials — DATABASE_URL must be set via environment
"""

from __future__ import annotations

import enum
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Index, Integer, String, Text, func, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import JSON

# ── Engine ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ["DATABASE_URL"]   # required — no fallback with credentials

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,          # detect stale connections before using them
    pool_recycle=1800,           # recycle connections every 30 min
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Enums ─────────────────────────────────────────────────────────────────────

class RunStatus(str, enum.Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    CANCELLED = "cancelled"


class ActionType(str, enum.Enum):
    NOTIFY    = "notify"
    TAG       = "tag"
    DEALLOCATE = "deallocate"
    RESIZE    = "resize"
    DELETE    = "delete"
    SNAPSHOT  = "snapshot"
    TIER_DOWN = "tier_down"


class Severity(str, enum.Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


# ── Base ──────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── Models ────────────────────────────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(String, unique=True, nullable=False, index=True)
    name            = Column(String, nullable=False)
    tenant_id       = Column(String, nullable=False)
    enabled         = Column(Boolean, nullable=False, server_default=text("true"))
    created_at      = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Policy(Base):
    __tablename__ = "policies"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name              = Column(String, nullable=False)
    description       = Column(Text)
    resource_type     = Column(String, nullable=False)
    category          = Column(String, nullable=False)
    severity          = Column(Enum(Severity), nullable=False, server_default=text("'medium'"))
    yaml_content      = Column(Text, nullable=False)
    enabled           = Column(Boolean, nullable=False, server_default=text("true"))
    schedule          = Column(String)
    grace_period_hours = Column(Integer, nullable=False, server_default=text("72"))
    created_at        = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), nullable=False,
                               server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_policies_enabled_category", "enabled", "category"),
    )


class PolicyRun(Base):
    __tablename__ = "policy_runs"

    id                       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id                = Column(UUID(as_uuid=True), ForeignKey("policies.id"), nullable=False)
    subscription_id          = Column(String, nullable=False)
    status                   = Column(Enum(RunStatus), nullable=False, server_default=text("'pending'"))
    task_id                  = Column(String)
    resources_found          = Column(Integer, nullable=False, server_default=text("0"))
    estimated_monthly_waste  = Column(Float, nullable=False, server_default=text("0.0"))
    output                   = Column(JSON)
    error                    = Column(Text)
    started_at               = Column(DateTime(timezone=True))
    completed_at             = Column(DateTime(timezone=True))
    created_at               = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_policy_runs_status",     "status"),
        Index("ix_policy_runs_created_at", "created_at"),
        Index("ix_policy_runs_policy_id",  "policy_id"),
    )


class WasteResource(Base):
    __tablename__ = "waste_resources"

    id                     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id                 = Column(UUID(as_uuid=True), ForeignKey("policy_runs.id"), nullable=False)
    subscription_id        = Column(String, nullable=False)
    resource_id            = Column(String, nullable=False)
    resource_name          = Column(String, nullable=False)
    resource_type          = Column(String, nullable=False)
    resource_group         = Column(String)
    location               = Column(String)
    policy_name            = Column(String, nullable=False)
    category               = Column(String, nullable=False)
    severity               = Column(Enum(Severity))
    estimated_monthly_cost = Column(Float, nullable=False, server_default=text("0.0"))
    tags                   = Column(JSON, default=dict)      # callable — not shared mutable {}
    metadata               = Column(JSON, default=dict)
    ladder_status          = Column(String, nullable=False, server_default=text("'notify'"))
    exempt                 = Column(Boolean, nullable=False, server_default=text("false"))
    first_seen             = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_seen              = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        Index("ix_waste_subscription_id",  "subscription_id"),
        Index("ix_waste_ladder_status",    "ladder_status"),
        Index("ix_waste_category",         "category"),
        Index("ix_waste_exempt",           "exempt"),
        Index("ix_waste_run_id",           "run_id"),
        # Composite for the most common UI filter
        Index("ix_waste_sub_ladder",       "subscription_id", "ladder_status"),
    )


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id     = Column(String, nullable=False)
    resource_name   = Column(String)
    subscription_id = Column(String, nullable=False)
    action_type     = Column(Enum(ActionType), nullable=False)
    status          = Column(Enum(RunStatus), nullable=False, server_default=text("'pending'"))
    task_id         = Column(String)
    initiated_by    = Column(String, nullable=False, server_default=text("'system'"))
    result          = Column(JSON)
    error           = Column(Text)
    created_at      = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at    = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_actions_status",      "status"),
        Index("ix_actions_resource_id", "resource_id"),
    )


# ── DB lifecycle ──────────────────────────────────────────────────────────────

async def init_db() -> None:
    """Create all tables and install Postgres NOTIFY triggers. Idempotent."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_triggers(conn)


async def _apply_triggers(conn) -> None:
    """Apply NOTIFY triggers from pg_triggers.sql. CREATE OR REPLACE is idempotent."""
    from sqlalchemy import text as sa_text
    trigger_file = Path(__file__).parent / "pg_triggers.sql"
    if not trigger_file.exists():
        return
    sql = trigger_file.read_text()
    await conn.execute(sa_text(sql))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
