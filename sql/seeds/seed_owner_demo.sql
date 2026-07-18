-- Owner dashboard demo fixtures + auth-bridge fix for Level approval.
-- Idempotent. Run after battery + CM + lit seeds.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- Level approval must resolve actor via Supabase Auth → core.staff (same as audit)
CREATE OR REPLACE FUNCTION core.enforce_level_approval() RETURNS trigger AS $$
DECLARE v_staff uuid; v_ok boolean;
BEGIN
  IF NEW.approved_level IS DISTINCT FROM OLD.approved_level
     OR (TG_OP = 'INSERT' AND NEW.approved_level IS NOT NULL) THEN
    v_staff := app.current_staff_id();
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'approved_level requires an authenticated staff session';
    END IF;
    SELECT can_approve_level INTO v_ok FROM core.staff WHERE staff_id = v_staff;
    IF NOT coalesce(v_ok, false) THEN
      RAISE EXCEPTION 'staff % is not authorized to approve or change Level', v_staff;
    END IF;
    NEW.level_approved_by := v_staff;
    NEW.level_approved_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Matter 1: missing Level (sign-up > 7d ago), pending recommendation, SOL mismatch
UPDATE core.client_matter
SET sign_up_date = CURRENT_DATE - 45,
    recommended_level = 2,
    recommended_level_rationale = 'Soft-tissue + some specialty care; CM recommends Level 2.',
    approved_level = NULL,
    level_approved_by = NULL,
    level_approved_at = NULL,
    sol_date = DATE '2027-09-15',   -- stored LATER than computed (DOI+2yr = 2027-07-02)
    sol_status = 'needs_review'
WHERE client_matter_id = '00000000-0000-0000-0000-00000000d001';

-- Matter 2: Level already set; SOL within 120d for watch tile
UPDATE core.client_matter
SET sign_up_date = CURRENT_DATE - 20,
    approved_level = 1,
    recommended_level = 1,
    sol_date = CURRENT_DATE + 60,
    sol_status = 'calculated'
WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002';

-- Limitations analysis (trigger fills computed_sol_date from DOI / DOB)
INSERT INTO core.limitations_analysis (
  limitations_analysis_id, client_matter_id, governing_statute, base_accrual_date
)
SELECT
  '00000000-0000-0000-0000-00000000a801',
  '00000000-0000-0000-0000-00000000d001',
  'CPRC 16.003 (2 yr) — ATTORNEY-VERIFY',
  DATE '2025-07-02'
WHERE NOT EXISTS (
  SELECT 1 FROM core.limitations_analysis
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d001');

INSERT INTO core.limitations_analysis (
  limitations_analysis_id, client_matter_id, governing_statute, base_accrual_date
)
SELECT
  '00000000-0000-0000-0000-00000000a802',
  '00000000-0000-0000-0000-00000000d002',
  'CPRC 16.003 (2 yr) — ATTORNEY-VERIFY',
  DATE '2026-03-18'
WHERE NOT EXISTS (
  SELECT 1 FROM core.limitations_analysis
  WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002');

-- Force recompute if rows already existed without dates
UPDATE core.limitations_analysis la
SET base_accrual_date = ig.date_of_loss,
    governing_statute = coalesce(la.governing_statute, 'CPRC 16.003 (2 yr) — ATTORNEY-VERIFY')
FROM core.client_matter m
JOIN core.incident_group ig ON ig.incident_group_id = m.incident_group_id
WHERE la.client_matter_id = m.client_matter_id
  AND m.client_matter_id IN (
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000d002'
  );

-- Pinned critical note on matter 1
INSERT INTO workflow.note (
  note_id, entity_id, author_staff_id, note_type, body, pinned
)
SELECT
  '00000000-0000-0000-0000-00000000a811',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000e012',
  'critical',
  'Owner demo: Level still unapproved — CM waiting on Michael.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM workflow.note WHERE note_id = '00000000-0000-0000-0000-00000000a811');

-- Manual-override completion for override-patterns tile
UPDATE workflow.task
SET status = 'done',
    completed_at = now() - interval '2 days',
    completed_by = '00000000-0000-0000-0000-00000000e012',
    completion_method = 'manual_override',
    override_reason = 'Client already confirmed LOR verbally — checklist obsolete'
WHERE task_id = '00000000-0000-0000-0000-00000000a601'
  AND status <> 'done';

SELECT 'seed_owner_demo OK' AS status,
       (SELECT count(*) FROM workflow.v_stalled_cases WHERE flag_missing_level) AS missing_level,
       (SELECT count(*) FROM workflow.v_stalled_cases WHERE flag_sol_within_120d) AS sol_soon,
       (SELECT count(*) FROM core.client_matter
         WHERE recommended_level IS NOT NULL AND approved_level IS NULL
           AND deleted_at IS NULL) AS pending_level,
       (SELECT count(*) FROM core.v_sol_reconciliation
         WHERE reconciliation <> 'match') AS sol_nonmatch;

COMMIT;
