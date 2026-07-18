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

-- ---------------------------------------------------------------------------
-- Provider Calls deepen: org + provider + primary PM episode + due call task
-- ---------------------------------------------------------------------------
INSERT INTO core.organization (organization_id, name, org_type)
SELECT '00000000-0000-0000-0000-00000000b0c1',
       'Alamo Pain & Spine',
       'medical_provider'
WHERE NOT EXISTS (
  SELECT 1 FROM core.organization WHERE organization_id = '00000000-0000-0000-0000-00000000b0c1');

INSERT INTO medical.provider (provider_id, organization_id, provider_type, accepts_lop)
SELECT '00000000-0000-0000-0000-00000000b0c2',
       '00000000-0000-0000-0000-00000000b0c1',
       'pain_management',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM medical.provider WHERE provider_id = '00000000-0000-0000-0000-00000000b0c2');

INSERT INTO medical.treatment_episode (
  treatment_episode_id, client_matter_id, provider_id,
  is_primary_pm, under_lop, status, approx_balance, balance_as_of,
  first_visit_date, last_visit_date
)
SELECT
  '00000000-0000-0000-0000-00000000b0e1',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000b0c2',
  true, true, 'active', 18450.00, CURRENT_DATE - 3,
  DATE '2025-08-12', CURRENT_DATE - 7
WHERE NOT EXISTS (
  SELECT 1 FROM medical.treatment_episode
  WHERE treatment_episode_id = '00000000-0000-0000-0000-00000000b0e1');

INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a604',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'provider_call',
  'Bi-weekly provider treatment/balance check',
  'Primary PM — Alamo Pain & Spine',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE - 1,
  'high',
  'open',
  'seed',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a604');

-- PD vehicle + claim (Delgado incident)
INSERT INTO property.vehicle (
  vehicle_id, incident_group_id, year, make, model,
  current_location, drivable, storage_accruing, is_client_vehicle
)
SELECT
  '00000000-0000-0000-0000-00000000b0a1',
  '00000000-0000-0000-0000-00000000b001',
  2019, 'Toyota', 'Camry',
  'Alamo Towing — lot B', false, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM property.vehicle WHERE vehicle_id = '00000000-0000-0000-0000-00000000b0a1');

INSERT INTO property.pd_claim (
  pd_claim_id, vehicle_id, status, owner_staff_id,
  opened_date, last_touch_date, repairable_or_total, estimate_amount, demand_blocker
)
SELECT
  '00000000-0000-0000-0000-00000000b0a2',
  '00000000-0000-0000-0000-00000000b0a1',
  'in_progress',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE - 20, CURRENT_DATE - 12,
  'undetermined', 8750.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM property.pd_claim WHERE pd_claim_id = '00000000-0000-0000-0000-00000000b0a2');

-- Coverage N/A samples + records request + draft demand
INSERT INTO medical.coverage_na (client_matter_id, category, declared_by)
SELECT '00000000-0000-0000-0000-00000000d001', 'ems',
       '00000000-0000-0000-0000-00000000e012'
WHERE NOT EXISTS (
  SELECT 1 FROM medical.coverage_na
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d001' AND category = 'ems');

INSERT INTO medical.record_request (
  record_request_id, treatment_episode_id, request_type, status,
  sent_date, follow_up_due, hipaa_verified
)
SELECT
  '00000000-0000-0000-0000-00000000b0a3',
  '00000000-0000-0000-0000-00000000b0e1',
  'records_and_bills', 'sent',
  CURRENT_DATE - 10, CURRENT_DATE + 4, true
WHERE NOT EXISTS (
  SELECT 1 FROM medical.record_request
  WHERE record_request_id = '00000000-0000-0000-0000-00000000b0a3');

INSERT INTO resolution.demand (
  demand_id, client_matter_id, demand_type, amount, drafted_by, notes
)
SELECT
  '00000000-0000-0000-0000-00000000b0a4',
  '00000000-0000-0000-0000-00000000d001',
  'standard', 185000.00,
  '00000000-0000-0000-0000-00000000e012',
  'Draft — awaiting Kate review'
WHERE NOT EXISTS (
  SELECT 1 FROM resolution.demand WHERE demand_id = '00000000-0000-0000-0000-00000000b0a4');

SELECT 'seed_cm_demo OK' AS status,
       (SELECT count(*) FROM core.staff_assignment WHERE ended_at IS NULL) AS assignments,
       (SELECT count(*) FROM workflow.task WHERE status = 'open') AS open_tasks,
       (SELECT count(*) FROM medical.v_provider_calls_due) AS provider_calls_due,
       (SELECT count(*) FROM property.pd_claim) AS pd_claims,
       (SELECT count(*) FROM medical.record_request) AS record_requests;

COMMIT;
