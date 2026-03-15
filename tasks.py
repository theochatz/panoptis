-- Postgres NOTIFY triggers for real-time SSE updates.
--
-- These triggers fire on INSERT/UPDATE to the three key tables and send
-- a NOTIFY on the "custodian" channel with a compact JSON payload.
-- The FastAPI broadcaster receives the notification and fans it out to
-- all connected browser SSE clients immediately.
--
-- Applied automatically by init_db() via execute_trigger_sql() in database.py.

-- ── Helper function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION custodian_notify()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  payload TEXT;
BEGIN
  IF TG_TABLE_NAME = 'policy_runs' THEN
    payload := json_build_object(
      'type',                    'run_updated',
      'id',                      NEW.id,
      'status',                  NEW.status,
      'resources_found',         NEW.resources_found,
      'estimated_monthly_waste', NEW.estimated_monthly_waste,
      'subscription_id',         NEW.subscription_id,
      'started_at',              NEW.started_at,
      'completed_at',            NEW.completed_at,
      'error',                   NEW.error
    )::text;

  ELSIF TG_TABLE_NAME = 'waste_resources' THEN
    payload := json_build_object(
      'type',            'resource_added',
      'id',              NEW.id,
      'subscription_id', NEW.subscription_id,
      'resource_name',   NEW.resource_name,
      'resource_type',   NEW.resource_type,
      'policy_name',     NEW.policy_name,
      'category',        NEW.category,
      'severity',        NEW.severity,
      'ladder_status',   NEW.ladder_status,
      'estimated_monthly_cost', NEW.estimated_monthly_cost
    )::text;

  ELSIF TG_TABLE_NAME = 'remediation_actions' THEN
    payload := json_build_object(
      'type',          'action_updated',
      'id',            NEW.id,
      'action_type',   NEW.action_type,
      'status',        NEW.status,
      'resource_name', NEW.resource_name,
      'subscription_id', NEW.subscription_id,
      'result',        NEW.result,
      'error',         NEW.error
    )::text;
  END IF;

  -- Postgres NOTIFY payload is limited to 8000 bytes; truncate if needed
  PERFORM pg_notify('custodian', LEFT(payload, 7900));
  RETURN NEW;
END;
$$;

-- ── policy_runs trigger ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_policy_runs_notify ON policy_runs;
CREATE TRIGGER trg_policy_runs_notify
  AFTER INSERT OR UPDATE OF status, resources_found, estimated_monthly_waste,
                             started_at, completed_at, error
  ON policy_runs
  FOR EACH ROW EXECUTE FUNCTION custodian_notify();

-- ── waste_resources trigger ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_waste_resources_notify ON waste_resources;
CREATE TRIGGER trg_waste_resources_notify
  AFTER INSERT OR UPDATE OF ladder_status, exempt, estimated_monthly_cost
  ON waste_resources
  FOR EACH ROW EXECUTE FUNCTION custodian_notify();

-- ── remediation_actions trigger ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_remediation_actions_notify ON remediation_actions;
CREATE TRIGGER trg_remediation_actions_notify
  AFTER INSERT OR UPDATE OF status, result, error
  ON remediation_actions
  FOR EACH ROW EXECUTE FUNCTION custodian_notify();
