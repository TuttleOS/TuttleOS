-- Intake RLS smoke: intake-only staff cannot read medical.*
-- Requires seed_intake_demo.sql + seed_battery_fixtures.sql (matter TEST-0001).
-- Uses SET ROLE app_staff so RLS is not bypassed (postgres bypasses RLS).
\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

INSERT INTO core.organization (organization_id, name, org_type)
VALUES ('00000000-0000-0000-0000-00000000a0c1', 'Demo Clinic', 'medical_provider')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO medical.provider (provider_id, organization_id, provider_type)
VALUES ('00000000-0000-0000-0000-00000000a0c2', '00000000-0000-0000-0000-00000000a0c1', 'urgent_care')
ON CONFLICT (provider_id) DO NOTHING;

INSERT INTO medical.treatment_episode (
  treatment_episode_id, client_matter_id, provider_id, status
)
VALUES (
  '00000000-0000-0000-0000-00000000a0c3',
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000a0c2',
  'active'
)
ON CONFLICT (treatment_episode_id) DO NOTHING;

SET LOCAL ROLE app_staff;

SELECT CASE
  WHEN count(*) >= 1 THEN 'PASS'
  ELSE 'FAIL'
END AS attorney_sees_medical
FROM medical.treatment_episode
WHERE treatment_episode_id = '00000000-0000-0000-0000-00000000a0c3';

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000e022', false);

SELECT CASE WHEN app.is_intake_only() THEN 'PASS' ELSE 'FAIL' END AS intake_only_flag;

SELECT CASE
  WHEN count(*) = 0 THEN 'PASS'
  ELSE 'FAIL'
END AS medical_blocked_for_intake
FROM medical.treatment_episode
WHERE treatment_episode_id = '00000000-0000-0000-0000-00000000a0c3';

SELECT CASE
  WHEN count(*) >= 1 THEN 'PASS'
  ELSE 'FAIL'
END AS intake_leads_visible
FROM core.intake_lead
WHERE deleted_at IS NULL;

COMMIT;
