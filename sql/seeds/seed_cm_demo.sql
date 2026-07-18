-- Seed CM assignments + sample tasks for demo matters (idempotent).
-- Assigns Michael (attorney) as case_manager so /cases has data for owner/admin testing.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- Michael as CM on both battery matters
INSERT INTO core.staff_assignment (
  staff_assignment_id, client_matter_id, staff_id, assignment_role, assigned_by
)
SELECT
  '00000000-0000-0000-0000-00000000a501',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000e012',
  'case_manager',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM core.staff_assignment
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d001'
    AND assignment_role = 'case_manager' AND ended_at IS NULL);

INSERT INTO core.staff_assignment (
  staff_assignment_id, client_matter_id, staff_id, assignment_role, assigned_by
)
SELECT
  '00000000-0000-0000-0000-00000000a502',
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000e012',
  'case_manager',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM core.staff_assignment
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002'
    AND assignment_role = 'case_manager' AND ended_at IS NULL);

-- Sample open tasks owned by Michael on matter 1
INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a601',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'checklist',
  'Confirm LOR sent to liability carrier',
  'Sign-up checklist item',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 3,
  'high',
  'open',
  'contract_signed',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a601');

INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a602',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'follow_up',
  'Call client — treatment status check',
  'Bi-weekly touch',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 1,
  'normal',
  'open',
  'manual',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a602');

INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a603',
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000d002',
  'checklist',
  'Request medical records — primary provider',
  'Records stage',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 5,
  'normal',
  'open',
  'manual',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a603');

SELECT 'seed_cm_demo OK' AS status,
       (SELECT count(*) FROM core.staff_assignment WHERE ended_at IS NULL) AS assignments,
       (SELECT count(*) FROM workflow.task WHERE status = 'open') AS open_tasks;

COMMIT;
