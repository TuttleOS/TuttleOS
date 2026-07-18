-- Seed litigation demo data (idempotent).
-- PL assignment, court_case (if missing), deadlines, stage-grouped tasks.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- Michael as litigation_paralegal on both battery matters
INSERT INTO core.staff_assignment (
  staff_assignment_id, client_matter_id, staff_id, assignment_role, assigned_by
)
SELECT
  '00000000-0000-0000-0000-00000000a511',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000e012',
  'litigation_paralegal',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM core.staff_assignment
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d001'
    AND assignment_role = 'litigation_paralegal' AND ended_at IS NULL);

INSERT INTO core.staff_assignment (
  staff_assignment_id, client_matter_id, staff_id, assignment_role, assigned_by
)
SELECT
  '00000000-0000-0000-0000-00000000a512',
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000e012',
  'litigation_paralegal',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM core.staff_assignment
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002'
    AND assignment_role = 'litigation_paralegal' AND ended_at IS NULL);

-- Court case for matter 1 (skip if battery or prior seed already filed one)
INSERT INTO litigation.court_case (
  court_case_id, client_matter_id, court_id, cause_number, style,
  filed_date, discovery_level, dco_signed_date, jury_demanded, hb19_applies, status
)
SELECT
  '00000000-0000-0000-0000-00000000a701',
  '00000000-0000-0000-0000-00000000d001',
  (SELECT court_id FROM ref.court ORDER BY court_id LIMIT 1),
  '2026-CI-04521',
  'Rosa Delgado v. Example Carrier et al.',
  DATE '2026-04-10',
  2,
  DATE '2026-06-01',
  true,
  false,
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM litigation.court_case
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d001'
    AND deleted_at IS NULL);

-- Court case for matter 2 (lighter — recently filed)
INSERT INTO litigation.court_case (
  court_case_id, client_matter_id, court_id, cause_number, style,
  filed_date, discovery_level, jury_demanded, status
)
SELECT
  '00000000-0000-0000-0000-00000000a702',
  '00000000-0000-0000-0000-00000000d002',
  (SELECT court_id FROM ref.court ORDER BY court_id LIMIT 1),
  '2026-CI-06118',
  'Chinedu Okafor v. Example Defendant',
  DATE '2026-06-20',
  2,
  true,
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM litigation.court_case
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002'
    AND deleted_at IS NULL);

-- Demo deadlines on matter 1 (entity_id = matter; within / past 45-day horizon)
INSERT INTO workflow.deadline (
  deadline_id, entity_id, client_matter_id, rule_code, label,
  base_event, base_date, computed_date, effective_date,
  source, jurisdictional, status, owner_staff_id
)
SELECT
  '00000000-0000-0000-0000-00000000a711',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'initial_disclosures_30',
  'Plaintiff initial disclosures due',
  'answer filed',
  DATE '2026-05-15',
  CURRENT_DATE + 12,
  CURRENT_DATE + 12,
  'rule',
  false,
  'pending',
  '00000000-0000-0000-0000-00000000e012'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.deadline WHERE deadline_id = '00000000-0000-0000-0000-00000000a711');

INSERT INTO workflow.deadline (
  deadline_id, entity_id, client_matter_id, rule_code, label,
  base_event, base_date, computed_date, effective_date,
  source, jurisdictional, status, owner_staff_id
)
SELECT
  '00000000-0000-0000-0000-00000000a712',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'discovery_response_30',
  'Respond to Defendant RFPs (set 1)',
  'served',
  CURRENT_DATE - 5,
  CURRENT_DATE + 25,
  CURRENT_DATE + 25,
  'rule',
  false,
  'pending',
  '00000000-0000-0000-0000-00000000e012'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.deadline WHERE deadline_id = '00000000-0000-0000-0000-00000000a712');

INSERT INTO workflow.deadline (
  deadline_id, entity_id, client_matter_id, label,
  effective_date, source, jurisdictional, status, owner_staff_id, adjusted_reason
)
SELECT
  '00000000-0000-0000-0000-00000000a713',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'Mediation — attendance',
  CURRENT_DATE + 35,
  'court_order',
  false,
  'pending',
  '00000000-0000-0000-0000-00000000e012',
  'DCO mediation setting'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.deadline WHERE deadline_id = '00000000-0000-0000-0000-00000000a713');

-- Overdue JX-ish SOL watch (display only — attorney-verify)
INSERT INTO workflow.deadline (
  deadline_id, entity_id, client_matter_id, rule_code, label,
  effective_date, source, jurisdictional, status, owner_staff_id
)
SELECT
  '00000000-0000-0000-0000-00000000a714',
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000d002',
  'answer_monday_next_20',
  'Defendant answer due (citation)',
  CURRENT_DATE - 3,
  'rule',
  false,
  'pending',
  '00000000-0000-0000-0000-00000000e012'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.deadline WHERE deadline_id = '00000000-0000-0000-0000-00000000a714');

INSERT INTO workflow.deadline (
  deadline_id, entity_id, client_matter_id, label,
  effective_date, source, jurisdictional, status, owner_staff_id
)
SELECT
  '00000000-0000-0000-0000-00000000a715',
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000d002',
  'File petition / confirm e-file receipt',
  CURRENT_DATE + 7,
  'manual',
  true,
  'pending',
  '00000000-0000-0000-0000-00000000e012'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.deadline WHERE deadline_id = '00000000-0000-0000-0000-00000000a715');

-- Lit tasks owned by Michael (titles drive My Tasks stage groups)
INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a721',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'checklist',
  'Confirm citation service completed',
  'Filing & service',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 2,
  'high',
  'open',
  'manual',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a721');

INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a722',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'checklist',
  'Draft / serve initial disclosures (TRCP 194)',
  'Answers & disclosures',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 10,
  'high',
  'open',
  'manual',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a722');

INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a723',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000d001',
  'checklist',
  'Prepare written discovery — interrogatories set 1',
  'Written discovery',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 18,
  'normal',
  'open',
  'manual',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a723');

INSERT INTO workflow.task (
  task_id, entity_id, client_matter_id, task_type, title, description,
  owner_staff_id, due_date, priority, status, trigger_source, created_by
)
SELECT
  '00000000-0000-0000-0000-00000000a724',
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000d002',
  'follow_up',
  'Calendar mediation date with client',
  'Mediation',
  '00000000-0000-0000-0000-00000000e012',
  CURRENT_DATE + 30,
  'normal',
  'open',
  'manual',
  '00000000-0000-0000-0000-00000000c0de'
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.task WHERE task_id = '00000000-0000-0000-0000-00000000a724');

SELECT 'seed_lit_demo OK' AS status,
       (SELECT count(*) FROM core.staff_assignment
         WHERE assignment_role = 'litigation_paralegal' AND ended_at IS NULL) AS pl_assigns,
       (SELECT count(*) FROM litigation.court_case WHERE deleted_at IS NULL) AS court_cases,
       (SELECT count(*) FROM workflow.deadline WHERE status = 'pending') AS pending_deadlines,
       (SELECT count(*) FROM workflow.task
         WHERE task_id BETWEEN '00000000-0000-0000-0000-00000000a721'
                           AND '00000000-0000-0000-0000-00000000a724') AS lit_demo_tasks;

COMMIT;
