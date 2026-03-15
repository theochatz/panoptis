"""
Celery tasks for the Azure Custodian platform.

Key design:
  - run_policy_set   uses c7n-org to run N policies x M subscriptions in one
                     subprocess call. c7n-org handles parallelism internally.
  - apply_remediation  calls the Azure SDK directly per resource action.
  - advance_ladder     progresses waste resources through the remediation ladder.
  - trigger_scheduled_policies  called by Beat; dispatches run_policy_set.

DB access pattern:
  - All psycopg2 connections use context managers to guarantee cleanup even on
    exceptions. Imports are at module level, not inside task bodies.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
import yaml
from celery import Celery
from celery.schedules import crontab

logger = logging.getLogger(__name__)

# ── Broker & result backend: PostgreSQL (same instance as app data) ───────────
# DATABASE_URL is required — set via K8s Secret. No hardcoded fallback.
_PG_DSN = (
    os.environ["DATABASE_URL"]
    .replace("postgresql+asyncpg://", "postgresql://")
)
BROKER_URL      = os.getenv("CELERY_BROKER_URL",     f"sqla+{_PG_DSN}")
RESULT_BACKEND  = os.getenv("CELERY_RESULT_BACKEND",  f"db+{_PG_DSN}")

celery_app = Celery("custodian", broker=BROKER_URL, backend=RESULT_BACKEND)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_transport_options={"confirm_publish": True},
    task_routes={
        "app.workers.tasks.run_policy_set":    {"queue": "policy-runs"},
        "app.workers.tasks.apply_remediation": {"queue": "remediation"},
        "app.workers.tasks.send_notification": {"queue": "notifications"},
        "app.workers.tasks.advance_ladder":    {"queue": "remediation"},
    },
    beat_schedule={
        "sweep-idle-hourly": {
            "task": "app.workers.tasks.trigger_scheduled_policies",
            "schedule": crontab(minute=0),
            "args": [["idle"]],
        },
        "sweep-tagging-daily": {
            "task": "app.workers.tasks.trigger_scheduled_policies",
            "schedule": crontab(hour=2, minute=0),
            "args": [["tagging"]],
        },
        "sweep-rightsizing-weekly": {
            "task": "app.workers.tasks.trigger_scheduled_policies",
            "schedule": crontab(hour=3, minute=0, day_of_week=1),
            "args": [["right-size", "orphaned", "storage"]],
        },
        "advance-ladder-6h": {
            "task": "app.workers.tasks.advance_ladder",
            "schedule": crontab(hour="*/6", minute=30),
            "args": [],
        },
    },
)


# ── DB helpers ─────────────────────────────────────────────────────────────────
# psycopg2 is used in sync Celery tasks. All connections use context managers
# so connections are always returned to the OS even if an exception occurs.

def _dsn() -> str:
    return os.environ["DATABASE_URL"].replace("+asyncpg", "")


def _sync_update_run(run_id: str, **kwargs: object) -> None:
    """Update a policy_run row. Uses context manager — connection always closed."""
    sets = ", ".join(f"{k} = %s" for k in kwargs)
    vals = list(kwargs.values()) + [run_id]
    try:
        with psycopg2.connect(_dsn()) as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE policy_runs SET {sets} WHERE id = %s::uuid", vals)
    except psycopg2.Error as exc:
        logger.error("DB update failed for run %s: %s", run_id, exc)


def _sync_insert_waste_resources(
    run_id: str,
    subscription_id: str,
    resources: list[dict],
    policy_name: str,
    category: str,
    severity: str,
) -> None:
    """Bulk-insert waste resources. Uses context manager."""
    if not resources:
        return
    try:
        with psycopg2.connect(_dsn()) as conn:
            with conn.cursor() as cur:
                for r in resources:
                    rid   = r.get("id", "")
                    name  = r.get("name") or (rid.split("/")[-1] if rid else "unknown")
                    rg    = rid.split("/resourceGroups/")[1].split("/")[0] if "/resourceGroups/" in rid else ""
                    loc   = r.get("location", "")
                    rtype = r.get("type", "")
                    cost  = _estimate_cost(r, rtype)
                    tags  = r.get("tags") or {}
                    cur.execute(
                        """
                        INSERT INTO waste_resources
                          (id, run_id, subscription_id, resource_id, resource_name,
                           resource_type, resource_group, location, policy_name,
                           category, severity, estimated_monthly_cost,
                           tags, metadata, ladder_status, first_seen, last_seen)
                        VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s, %s, %s, 'notify', now(), now())
                        ON CONFLICT DO NOTHING
                        """,
                        (
                            str(uuid.uuid4()), run_id, subscription_id, rid, name,
                            rtype, rg, loc, policy_name, category, severity, cost,
                            psycopg2.extras.Json(tags), psycopg2.extras.Json(r),
                        ),
                    )
    except psycopg2.Error as exc:
        logger.error("Waste resource insert failed: %s", exc)


def _estimate_cost(resource: dict, resource_type: str) -> float:
    """Heuristic cost estimator — replace with Azure Cost Management API call."""
    sku = (resource.get("properties") or {}).get("hardwareProfile", {}).get("vmSize", "")
    vm_costs = {
        "Standard_D2s_v3": 96,  "Standard_D4s_v3": 192, "Standard_D8s_v3": 384,
        "Standard_D2s_v5": 87,  "Standard_D4s_v5": 174, "Standard_D8s_v5": 348,
        "Standard_B2s":    38,  "Standard_B4ms":   76,  "Standard_B8ms":   152,
    }
    t = (resource_type or "").lower()
    if "virtualmachines" in t:  return vm_costs.get(sku, 80.0)
    if "disk" in t:             return float((resource.get("properties") or {}).get("diskSizeGB", 128)) * 0.05
    if "publicipaddress" in t:  return 3.65
    if "sqldatabase" in t:      return 150.0
    if "storageaccount" in t:   return 12.0
    if "serverfarm" in t:       return 80.0
    return 20.0


# ── c7n-org helpers ────────────────────────────────────────────────────────────

def _write_accounts_file(subscriptions: list[dict], path: str) -> None:
    """Write a c7n-org accounts.yml from the subscription list."""
    accounts = [
        {
            "name":            s["name"],
            "subscription_id": s["subscription_id"],
            "tenant_id":       s["tenant_id"],
            **({"tags": [s["environment"]]} if s.get("environment") else {}),
        }
        for s in subscriptions
    ]
    with open(path, "w") as f:
        yaml.dump({"accounts": accounts}, f, default_flow_style=False)
    logger.debug("accounts.yml: %d subscriptions → %s", len(accounts), path)


def _write_policy_files(policies: list[dict], tmp_dir: str) -> list[str]:
    """Write each policy YAML to a separate file. Returns list of paths."""
    paths = []
    for p in policies:
        path = os.path.join(tmp_dir, f"policy_{p['id']}.yml")
        with open(path, "w") as f:
            f.write(p["yaml_content"])
        paths.append(path)
    return paths


def _parse_c7n_org_output(
    output_dir: str, subscriptions: list[dict], policies: list[dict]
) -> dict:
    """
    Parse c7n-org output tree: output_dir/<account_name>/<policy_name>/resources.json
    Returns aggregated result dict.
    """
    sub_map = {s["name"]: s["subscription_id"] for s in subscriptions}
    pol_map = {p["name"]: (p["category"], p["severity"]) for p in policies}

    result: dict = {
        "total_resources": 0,
        "total_waste":     0.0,
        "by_subscription": {},
        "all_resources":   [],
    }

    for resources_file in sorted(Path(output_dir).glob("*/*/resources.json")):
        acct_name   = resources_file.parts[-3]
        policy_name = resources_file.parts[-2]
        sub_id      = sub_map.get(acct_name, acct_name)
        cat, sev    = pol_map.get(policy_name, ("unknown", "medium"))

        try:
            with open(resources_file) as f:
                resources = json.load(f)
            if not isinstance(resources, list):
                continue
        except Exception as exc:
            logger.warning("Could not parse %s: %s", resources_file, exc)
            continue

        cost = sum(_estimate_cost(r, r.get("type", "")) for r in resources)

        if acct_name not in result["by_subscription"]:
            result["by_subscription"][acct_name] = {
                "subscription_id": sub_id,
                "resources":       [],
                "total_cost":      0.0,
            }

        for r in resources:
            r["_subscription_id"] = sub_id
            r["_policy_name"]     = policy_name
            r["_category"]        = cat
            r["_severity"]        = sev

        result["by_subscription"][acct_name]["resources"].extend(resources)
        result["by_subscription"][acct_name]["total_cost"] += cost
        result["all_resources"].extend(resources)
        result["total_resources"] += len(resources)
        result["total_waste"]     += cost

    return result


# ── Tasks ──────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.tasks.run_policy_set",
    max_retries=2,
    soft_time_limit=3600,
    time_limit=3900,
)
def run_policy_set(
    self,
    run_id: str,
    policies: list[dict],
    subscriptions: list[dict],
    parallel: int = 10,
) -> dict:
    """
    Execute N policies across M subscriptions using c7n-org.
    Single Celery task per sweep — c7n-org handles parallelism internally.
    """
    logger.info(
        "[%s] c7n-org sweep: %d policies x %d subscriptions (parallel=%d)",
        run_id, len(policies), len(subscriptions), parallel,
    )
    _sync_update_run(
        run_id,
        status="running",
        task_id=self.request.id,
        started_at=datetime.now(timezone.utc).isoformat(),
    )

    tmp_dir       = f"/tmp/c7n_run_{run_id}"
    output_dir    = f"/outputs/{run_id}"
    accounts_file = os.path.join(tmp_dir, "accounts.yml")

    Path(tmp_dir).mkdir(parents=True, exist_ok=True)
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    try:
        _write_accounts_file(subscriptions, accounts_file)
        policy_files = _write_policy_files(policies, tmp_dir)

        cmd = [
            "c7n-org", "run",
            "--config",     accounts_file,
            "--output-dir", output_dir,
            "--parallel",   str(parallel),
        ] + policy_files

        logger.info("[%s] Executing: %s", run_id, " ".join(cmd))

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3500,
            env={
                **os.environ,
                "AZURE_TENANT_ID":     os.getenv("AZURE_TENANT_ID", ""),
                "AZURE_CLIENT_ID":     os.getenv("AZURE_CLIENT_ID", ""),
                "AZURE_CLIENT_SECRET": os.getenv("AZURE_CLIENT_SECRET", ""),
            },
        )

        if proc.returncode != 0:
            logger.warning("[%s] c7n-org exited %d. stderr: %s",
                           run_id, proc.returncode, proc.stderr[-800:])

        result = _parse_c7n_org_output(output_dir, subscriptions, policies)

        # Persist waste resources grouped by subscription and policy
        for acct_data in result["by_subscription"].values():
            sub_id   = acct_data["subscription_id"]
            by_policy: dict[str, list] = {}
            for r in acct_data["resources"]:
                by_policy.setdefault(r.get("_policy_name", "unknown"), []).append(r)
            for pname, res_list in by_policy.items():
                _sync_insert_waste_resources(
                    run_id, sub_id, res_list,
                    pname,
                    res_list[0].get("_category", "unknown"),
                    res_list[0].get("_severity", "medium"),
                )

        stderr_snippet = proc.stderr[-500:].strip() if proc.returncode != 0 else None
        summary = {
            "subscriptions_scanned": len(subscriptions),
            "policies_run":          len(policies),
            "c7n_org_exit_code":     proc.returncode,
            "by_subscription": {
                k: {"resource_count": len(v["resources"]), "cost_gbp_mo": round(v["total_cost"], 2)}
                for k, v in result["by_subscription"].items()
            },
        }
        _sync_update_run(
            run_id,
            status="completed",
            resources_found=result["total_resources"],
            estimated_monthly_waste=round(result["total_waste"], 2),
            output=json.dumps(summary),
            error=stderr_snippet,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

        logger.info("[%s] Complete: %d resources, £%.2f/mo",
                    run_id, result["total_resources"], result["total_waste"])
        return {
            "run_id":    run_id,
            "resources": result["total_resources"],
            "waste":     round(result["total_waste"], 2),
        }

    except Exception as exc:
        logger.error("[%s] run_policy_set failed: %s", run_id, exc, exc_info=True)
        _sync_update_run(
            run_id,
            status="failed",
            error=str(exc),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        raise self.retry(exc=exc, countdown=60)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@celery_app.task(bind=True, name="app.workers.tasks.apply_remediation", max_retries=3)
def apply_remediation(
    self,
    action_id: str,
    resource_id: str,
    subscription_id: str,
    action_type: str,
    resource_name: str,
) -> dict:
    """Apply a single remediation action via the Azure SDK."""
    logger.info("[%s] %s -> %s", action_id, action_type, resource_name)
    dsn = _dsn()

    def _upd(status: str, result: dict | None = None, error: str | None = None) -> None:
        try:
            with psycopg2.connect(dsn) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE remediation_actions "
                        "SET status=%s, result=%s, error=%s, completed_at=now(), task_id=%s "
                        "WHERE id=%s::uuid",
                        (
                            status,
                            json.dumps(result) if result else None,
                            error,
                            self.request.id,
                            action_id,
                        ),
                    )
        except psycopg2.Error as exc:
            logger.error("Action DB update failed: %s", exc)

    ladder_map = {
        "deallocate": "deallocated", "delete": "deleted",
        "resize":     "resized",     "snapshot": "snapshotted",
        "tier_down":  "tiered_down", "tag": "tagged",
    }

    try:
        _upd("running")
        from app.services.azure_client import AzureRemediation
        res = AzureRemediation(subscription_id).execute(action_type, resource_id)

        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE waste_resources SET ladder_status=%s, last_seen=now() "
                    "WHERE resource_id=%s AND subscription_id=%s",
                    (ladder_map.get(action_type, action_type), resource_id, subscription_id),
                )

        _upd("completed", result=res)
        return res

    except Exception as exc:
        _upd("failed", error=str(exc))
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.workers.tasks.trigger_scheduled_policies")
def trigger_scheduled_policies(categories: list[str]) -> None:
    """
    Celery Beat entry-point. Fetches enabled policies and subscriptions,
    creates ONE PolicyRun record, dispatches ONE run_policy_set task.
    """
    logger.info("trigger_scheduled_policies categories=%s", categories)
    ph = ",".join(["%s"] * len(categories))

    with psycopg2.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, name, resource_type, category, severity, yaml_content "
                f"FROM policies WHERE enabled=true AND category IN ({ph})",
                categories,
            )
            policies = [
                {"id": str(r[0]), "name": r[1], "resource_type": r[2],
                 "category": r[3], "severity": r[4], "yaml_content": r[5]}
                for r in cur.fetchall()
            ]
            cur.execute(
                "SELECT subscription_id, name, tenant_id FROM subscriptions WHERE enabled=true"
            )
            subscriptions = [
                {"subscription_id": r[0], "name": r[1], "tenant_id": r[2], "environment": ""}
                for r in cur.fetchall()
            ]

    if not policies:
        logger.info("No enabled policies in categories %s — skipping", categories)
        return
    if not subscriptions:
        logger.info("No enabled subscriptions — skipping")
        return

    run_id = str(uuid.uuid4())

    with psycopg2.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO policy_runs "
                "(id, policy_id, subscription_id, status, created_at) "
                "VALUES (%s::uuid, %s::uuid, %s, 'pending', now())",
                (run_id, policies[0]["id"], "multi-subscription"),
            )

    run_policy_set.apply_async(
        args=[run_id, policies, subscriptions],
        kwargs={"parallel": min(len(subscriptions), 10)},
        queue="policy-runs",
    )
    logger.info(
        "Dispatched run_policy_set %s: %d policies x %d subscriptions",
        run_id, len(policies), len(subscriptions),
    )


@celery_app.task(name="app.workers.tasks.advance_ladder")
def advance_ladder() -> None:
    """Progress waste resources through the remediation ladder every 6h."""
    logger.info("advance_ladder: checking resources to progress")

    with psycopg2.connect(_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT wr.id, wr.resource_id, wr.subscription_id, wr.resource_name
                FROM waste_resources wr
                JOIN policy_runs pr ON wr.run_id = pr.id
                JOIN policies p     ON pr.policy_id = p.id::uuid
                WHERE wr.ladder_status = 'notify'
                  AND wr.exempt = false
                  AND wr.first_seen < now() - (p.grace_period_hours || ' hours')::interval
            """)
            to_tag = cur.fetchall()

            cur.execute("""
                SELECT id, resource_id, subscription_id, resource_name
                FROM waste_resources
                WHERE ladder_status = 'tagged'
                  AND exempt = false
                  AND last_seen < now() - interval '7 days'
            """)
            to_deallocate = cur.fetchall()

            cur.execute("""
                SELECT id, resource_id, subscription_id, resource_name
                FROM waste_resources
                WHERE ladder_status = 'deallocated'
                  AND exempt = false
                  AND last_seen < now() - interval '7 days'
            """)
            to_delete = cur.fetchall()

    for row in to_tag:
        apply_remediation.apply_async(
            args=[str(uuid.uuid4()), row[1], row[2], "tag", row[3]],
            queue="remediation",
        )
    for row in to_deallocate:
        apply_remediation.apply_async(
            args=[str(uuid.uuid4()), row[1], row[2], "deallocate", row[3]],
            queue="remediation",
        )
    for row in to_delete:
        apply_remediation.apply_async(
            args=[str(uuid.uuid4()), row[1], row[2], "delete", row[3]],
            queue="remediation",
        )

    logger.info(
        "advance_ladder: queued %d tag, %d deallocate, %d delete",
        len(to_tag), len(to_deallocate), len(to_delete),
    )
