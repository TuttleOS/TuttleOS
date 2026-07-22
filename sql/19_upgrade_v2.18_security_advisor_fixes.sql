-- v2.18 — Supabase Security Advisor fixes
-- Paste into Supabase → SQL Editor → Run (no psql meta-commands).
-- Then Security Advisor → Rerun linter.

-- A. Enable RLS on calendar tables + staff policies
ALTER TABLE workflow.calendar_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.deadline_calendar_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_read ON workflow.calendar_connection;
DROP POLICY IF EXISTS p_ins ON workflow.calendar_connection;
DROP POLICY IF EXISTS p_upd ON workflow.calendar_connection;
CREATE POLICY p_read ON workflow.calendar_connection
  FOR SELECT USING (app.is_active_staff());
CREATE POLICY p_ins ON workflow.calendar_connection
  FOR INSERT WITH CHECK (app.is_active_staff());
CREATE POLICY p_upd ON workflow.calendar_connection
  FOR UPDATE USING (app.is_active_staff())
  WITH CHECK (app.is_active_staff());

DROP POLICY IF EXISTS p_read ON workflow.deadline_calendar_sync;
DROP POLICY IF EXISTS p_ins ON workflow.deadline_calendar_sync;
DROP POLICY IF EXISTS p_upd ON workflow.deadline_calendar_sync;
CREATE POLICY p_read ON workflow.deadline_calendar_sync
  FOR SELECT USING (app.is_active_staff());
CREATE POLICY p_ins ON workflow.deadline_calendar_sync
  FOR INSERT WITH CHECK (app.is_active_staff());
CREATE POLICY p_upd ON workflow.deadline_calendar_sync
  FOR UPDATE USING (app.is_active_staff())
  WITH CHECK (app.is_active_staff());

REVOKE DELETE ON workflow.calendar_connection FROM authenticated, app_staff;
REVOKE DELETE ON workflow.deadline_calendar_sync FROM authenticated, app_staff;

-- B. View must use caller's privileges (security_invoker), not SECURITY DEFINER
DROP VIEW IF EXISTS workflow.v_task_override_patterns;
CREATE VIEW workflow.v_task_override_patterns
  WITH (security_invoker = true)
AS
SELECT
  pe.first_name || ' ' || pe.last_name AS staff,
  t.title,
  count(*) AS overrides_90d,
  max(t.completed_at) AS most_recent,
  (array_agg(t.override_reason ORDER BY t.completed_at DESC))[1:3] AS recent_reasons
FROM workflow.task t
JOIN core.staff s ON s.staff_id = t.completed_by
JOIN core.person pe ON pe.person_id = s.person_id
WHERE t.completion_method = 'manual_override'
  AND t.completed_at > now() - interval '90 days'
GROUP BY 1, 2;

GRANT SELECT ON workflow.v_task_override_patterns TO app_staff;
GRANT SELECT ON workflow.v_task_override_patterns TO authenticated;

-- Verify (should return t / t / {security_invoker=true})
SELECT
  (SELECT relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'workflow' AND c.relname = 'calendar_connection') AS calendar_rls,
  (SELECT relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'workflow' AND c.relname = 'deadline_calendar_sync') AS deadline_rls,
  (SELECT c.reloptions FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'workflow' AND c.relname = 'v_task_override_patterns') AS view_options;
