-- Seed fictional per-role test staff (idempotent).
-- Auth users are created by scripts/provision_role_test_accounts.mjs
-- (service role). Do not put passwords in this file.
--
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/seeds/seed_role_test_staff.sql

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
INSERT INTO core.person (person_id, first_name, last_name) VALUES
  ('00000000-0000-0000-0000-00000000e030', 'Camila', 'Manager'),
  ('00000000-0000-0000-0000-00000000e032', 'Leo', 'Paralegal'),
  ('00000000-0000-0000-0000-00000000e034', 'Kate', 'Demand'),
  ('00000000-0000-0000-0000-00000000e036', 'Emily', 'Liens'),
  ('00000000-0000-0000-0000-00000000e038', 'Daniel', 'Review')
ON CONFLICT (person_id) DO NOTHING;

-- Keep Ava Intake person from seed_intake_demo (e021)
INSERT INTO core.person (person_id, first_name, last_name)
VALUES ('00000000-0000-0000-0000-00000000e021', 'Ava', 'Intake')
ON CONFLICT (person_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Staff rows (auth_user_id filled by provision script)
-- ---------------------------------------------------------------------------
INSERT INTO core.staff (
  staff_id, person_id, role_code, email,
  auth_user_id, is_attorney, can_approve_level, can_clear_conflicts, active
) VALUES
  (
    '00000000-0000-0000-0000-00000000e031',
    '00000000-0000-0000-0000-00000000e030',
    'case_manager',
    'cm.demo@tuttlelawfirm.com',
    NULL, false, false, false, true
  ),
  (
    '00000000-0000-0000-0000-00000000e033',
    '00000000-0000-0000-0000-00000000e032',
    'litigation_paralegal',
    'lit.demo@tuttlelawfirm.com',
    NULL, false, false, false, true
  ),
  (
    '00000000-0000-0000-0000-00000000e022',
    '00000000-0000-0000-0000-00000000e021',
    'intake',
    'intake.demo@tuttlelawfirm.com',
    NULL, false, false, false, true
  ),
  (
    '00000000-0000-0000-0000-00000000e035',
    '00000000-0000-0000-0000-00000000e034',
    'demand_writer',
    'demand.demo@tuttlelawfirm.com',
    NULL, false, false, false, true
  ),
  (
    '00000000-0000-0000-0000-00000000e037',
    '00000000-0000-0000-0000-00000000e036',
    'lien_disbursement',
    'liens.demo@tuttlelawfirm.com',
    NULL, false, false, false, true
  ),
  (
    '00000000-0000-0000-0000-00000000e039',
    '00000000-0000-0000-0000-00000000e038',
    'senior_paralegal',
    'review.demo@tuttlelawfirm.com',
    -- † flags OFF until Michael confirms Daniel's authority (ROLES §8.1#3 / §8.2#1)
    NULL, false, false, false, true
  )
ON CONFLICT (staff_id) DO UPDATE
SET role_code = EXCLUDED.role_code,
    email = EXCLUDED.email,
    is_attorney = EXCLUDED.is_attorney,
    can_approve_level = EXCLUDED.can_approve_level,
    can_clear_conflicts = EXCLUDED.can_clear_conflicts,
    active = true;

-- ---------------------------------------------------------------------------
-- Give CM / Lit demos work on battery matters (end Michael's CM/PL slots).
-- Michael remains attorney/owner and still has firm-wide nav.
-- ---------------------------------------------------------------------------
UPDATE core.staff_assignment
SET ended_at = now()
WHERE staff_id = '00000000-0000-0000-0000-00000000e012'
  AND assignment_role IN ('case_manager', 'litigation_paralegal')
  AND ended_at IS NULL
  AND client_matter_id IN (
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000d002'
  );

INSERT INTO core.staff_assignment (
  staff_assignment_id, client_matter_id, staff_id, assignment_role, assigned_by
) VALUES
  (
    '00000000-0000-0000-0000-00000000a521',
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000e031',
    'case_manager',
    '00000000-0000-0000-0000-00000000c0de'
  ),
  (
    '00000000-0000-0000-0000-00000000a522',
    '00000000-0000-0000-0000-00000000d002',
    '00000000-0000-0000-0000-00000000e031',
    'case_manager',
    '00000000-0000-0000-0000-00000000c0de'
  ),
  (
    '00000000-0000-0000-0000-00000000a523',
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000e033',
    'litigation_paralegal',
    '00000000-0000-0000-0000-00000000c0de'
  ),
  (
    '00000000-0000-0000-0000-00000000a524',
    '00000000-0000-0000-0000-00000000d002',
    '00000000-0000-0000-0000-00000000e033',
    'litigation_paralegal',
    '00000000-0000-0000-0000-00000000c0de'
  )
ON CONFLICT (staff_assignment_id) DO UPDATE
SET staff_id = EXCLUDED.staff_id,
    client_matter_id = EXCLUDED.client_matter_id,
    assignment_role = EXCLUDED.assignment_role,
    assigned_by = EXCLUDED.assigned_by,
    ended_at = NULL;

-- Point open checklist / sample tasks at CM demo owner where owned by Michael
UPDATE workflow.task
SET owner_staff_id = '00000000-0000-0000-0000-00000000e031'
WHERE owner_staff_id = '00000000-0000-0000-0000-00000000e012'
  AND client_matter_id IN (
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000d002'
  )
  AND status IN ('open', 'in_progress')
  AND deleted_at IS NULL;

-- Primary role grants for demo staff (requires sql/20_upgrade_v2.19)
DO $$
BEGIN
  IF to_regclass('core.staff_role_grant') IS NULL THEN
    RAISE NOTICE 'core.staff_role_grant missing — skip grants (run sql/20 first)';
    RETURN;
  END IF;
  INSERT INTO core.staff_role_grant (staff_id, role_code, is_primary, granted_by)
  SELECT s.staff_id, s.role_code, true, '00000000-0000-0000-0000-00000000c0de'
  FROM core.staff s
  WHERE s.staff_id IN (
    '00000000-0000-0000-0000-00000000e031',
    '00000000-0000-0000-0000-00000000e033',
    '00000000-0000-0000-0000-00000000e022',
    '00000000-0000-0000-0000-00000000e035',
    '00000000-0000-0000-0000-00000000e037',
    '00000000-0000-0000-0000-00000000e039'
  )
  AND NOT EXISTS (
    SELECT 1 FROM core.staff_role_grant g
    WHERE g.staff_id = s.staff_id
      AND g.role_code = s.role_code
      AND g.ended_at IS NULL
  );
END $$;

SELECT 'seed_role_test_staff OK' AS status,
       s.email, s.role_code, s.staff_id, s.auth_user_id IS NOT NULL AS linked
FROM core.staff s
WHERE s.staff_id IN (
  '00000000-0000-0000-0000-00000000e031',
  '00000000-0000-0000-0000-00000000e033',
  '00000000-0000-0000-0000-00000000e022',
  '00000000-0000-0000-0000-00000000e035',
  '00000000-0000-0000-0000-00000000e037',
  '00000000-0000-0000-0000-00000000e039'
)
ORDER BY s.role_code;

COMMIT;
