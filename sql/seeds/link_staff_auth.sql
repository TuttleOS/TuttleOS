-- Link Supabase Auth users to core.staff (idempotent).
-- Project: vpakkbabfwfxzmpmrakd (TuttleOS)
-- Brett (developer / admin): 2845b80c-2a12-466d-8a6a-9a82317a2f6d
-- Michael (attorney / owner): 094ff36e-9b28-430b-9e36-233de11ce821

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

INSERT INTO core.person (person_id, first_name, last_name)
VALUES ('00000000-0000-0000-0000-00000000e001', 'Brett', 'Earl')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.staff (
  staff_id, person_id, role_code, email,
  auth_user_id, is_attorney, can_approve_level, can_clear_conflicts, active
) VALUES (
  '00000000-0000-0000-0000-00000000e002',
  '00000000-0000-0000-0000-00000000e001',
  'admin',
  'brett.earl@gmail.com',
  '2845b80c-2a12-466d-8a6a-9a82317a2f6d'::uuid,
  false, false, false, true
)
ON CONFLICT (staff_id) DO UPDATE
SET auth_user_id = EXCLUDED.auth_user_id,
    email = EXCLUDED.email,
    role_code = EXCLUDED.role_code,
    is_attorney = EXCLUDED.is_attorney,
    can_approve_level = EXCLUDED.can_approve_level,
    can_clear_conflicts = EXCLUDED.can_clear_conflicts,
    active = true;

INSERT INTO core.person (person_id, first_name, last_name)
VALUES ('00000000-0000-0000-0000-00000000e011', 'Michael', 'Tuttle')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.staff (
  staff_id, person_id, role_code, email,
  auth_user_id, is_attorney, can_approve_level, can_clear_conflicts, active
) VALUES (
  '00000000-0000-0000-0000-00000000e012',
  '00000000-0000-0000-0000-00000000e011',
  'attorney',
  'michael@tuttlelawfirm.com',
  '094ff36e-9b28-430b-9e36-233de11ce821'::uuid,
  true, true, true, true
)
ON CONFLICT (staff_id) DO UPDATE
SET auth_user_id = EXCLUDED.auth_user_id,
    email = EXCLUDED.email,
    role_code = EXCLUDED.role_code,
    is_attorney = EXCLUDED.is_attorney,
    can_approve_level = EXCLUDED.can_approve_level,
    can_clear_conflicts = EXCLUDED.can_clear_conflicts,
    active = true;

SELECT s.email, s.role_code, s.auth_user_id, s.active
FROM core.staff s
WHERE s.auth_user_id IN (
  '2845b80c-2a12-466d-8a6a-9a82317a2f6d'::uuid,
  '094ff36e-9b28-430b-9e36-233de11ce821'::uuid
)
ORDER BY s.email;

COMMIT;
