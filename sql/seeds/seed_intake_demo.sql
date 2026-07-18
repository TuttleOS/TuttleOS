-- Seed intake specialist staff + fictional queue leads (idempotent).
-- Auth link: create a Supabase Auth user, then set auth_user_id below
-- (same pattern as sql/seeds/link_staff_auth.sql).
--
-- Default placeholder email: intake.demo@tuttle.local
-- After Auth user exists, UPDATE core.staff SET auth_user_id = '<uuid>'
--   WHERE staff_id = '00000000-0000-0000-0000-00000000e021';

\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- ---------------------------------------------------------------------------
-- Intake specialist (role_code = intake, not attorney → RLS is_intake_only)
-- ---------------------------------------------------------------------------
INSERT INTO core.person (person_id, first_name, last_name)
VALUES ('00000000-0000-0000-0000-00000000e021', 'Ava', 'Intake')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.staff (
  staff_id, person_id, role_code, email,
  auth_user_id, is_attorney, can_approve_level, can_clear_conflicts, active
) VALUES (
  '00000000-0000-0000-0000-00000000e022',
  '00000000-0000-0000-0000-00000000e021',
  'intake',
  'intake.demo@tuttle.local',
  NULL,
  false, false, false, true
)
ON CONFLICT (staff_id) DO UPDATE
SET role_code = 'intake',
    email = EXCLUDED.email,
    is_attorney = false,
    active = true;

-- ---------------------------------------------------------------------------
-- Demo leads for queue tiles (fictional — no real clients)
-- ---------------------------------------------------------------------------
INSERT INTO core.person (person_id, first_name, last_name, preferred_language)
VALUES
  ('00000000-0000-0000-0000-00000000a101', 'Jordan', 'Reyes', 'en'),
  ('00000000-0000-0000-0000-00000000a102', 'Maria', 'Santos', 'es'),
  ('00000000-0000-0000-0000-00000000a103', 'Chris', 'Nguyen', 'en')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.contact_point (person_id, kind, phone, is_primary)
SELECT '00000000-0000-0000-0000-00000000a101', 'phone', '2105551001', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a101' AND kind = 'phone');

INSERT INTO core.contact_point (person_id, kind, email, is_primary)
SELECT '00000000-0000-0000-0000-00000000a101', 'email', 'jordan.reyes@example.com', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a101' AND kind = 'email');

INSERT INTO core.contact_point (person_id, kind, phone, is_primary)
SELECT '00000000-0000-0000-0000-00000000a102', 'phone', '2105551002', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a102' AND kind = 'phone');

INSERT INTO core.contact_point (person_id, kind, phone, is_primary)
SELECT '00000000-0000-0000-0000-00000000a103', 'phone', '2105551003', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a103' AND kind = 'phone');

INSERT INTO core.intake_lead (
  intake_lead_id, person_id, raw_name, raw_phone, raw_email,
  incident_date, case_type_code, description, marketing_source,
  estimated_sol_date, status, handled_by
) VALUES (
  '00000000-0000-0000-0000-00000000f101',
  '00000000-0000-0000-0000-00000000a101',
  'Jordan Reyes', '2105551001', 'jordan.reyes@example.com',
  DATE '2025-11-12', 'auto', 'San Antonio — I-10 near Callaghan',
  'Google Ads', DATE '2027-11-12', 'open',
  '00000000-0000-0000-0000-00000000e022'
) ON CONFLICT (intake_lead_id) DO NOTHING;

INSERT INTO core.intake_lead (
  intake_lead_id, person_id, raw_name, raw_phone, raw_email,
  incident_date, case_type_code, description, marketing_source,
  estimated_sol_date, status, handled_by
) VALUES (
  '00000000-0000-0000-0000-00000000f102',
  '00000000-0000-0000-0000-00000000a102',
  'Maria Santos', '2105551002', NULL,
  DATE '2025-09-01', 'premises', 'HEB parking lot, Schertz',
  'Walk-in', DATE '2027-09-01', 'contract_sent',
  '00000000-0000-0000-0000-00000000e022'
) ON CONFLICT (intake_lead_id) DO NOTHING;

INSERT INTO core.intake_lead (
  intake_lead_id, person_id, raw_name, raw_phone, raw_email,
  incident_date, case_type_code, description, marketing_source,
  estimated_sol_date, status, rejected_reason, handled_by
) VALUES (
  '00000000-0000-0000-0000-00000000f103',
  '00000000-0000-0000-0000-00000000a103',
  'Chris Nguyen', '2105551003', 'chris.nguyen@example.com',
  DATE '2024-06-15', 'auto', 'New Braunfels — Loop 337',
  'Referral', DATE '2026-06-15', 'rejected',
  'Liability unclear / no coverage',
  '00000000-0000-0000-0000-00000000e022'
) ON CONFLICT (intake_lead_id) DO NOTHING;
-- f103 has non_engagement_letter_sent_date NULL → NEL tile counts it

SELECT s.email, s.role_code, s.auth_user_id, s.active
FROM core.staff s
WHERE s.staff_id = '00000000-0000-0000-0000-00000000e022';

SELECT status, count(*) FROM core.intake_lead
WHERE intake_lead_id IN (
  '00000000-0000-0000-0000-00000000f101',
  '00000000-0000-0000-0000-00000000f102',
  '00000000-0000-0000-0000-00000000f103'
)
GROUP BY status
ORDER BY status;

COMMIT;
