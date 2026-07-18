-- Link a Supabase Auth user to the intake demo staff row.
-- 1. Create Auth user (Dashboard → Authentication → Users) e.g. intake@tuttlelawfirm.com
-- 2. Copy the user's UUID into :'auth_uid' below (or replace the literal).
-- 3. Run: psql "$DATABASE_URL" -f sql/seeds/link_intake_staff_auth.sql
--
-- Default target staff_id: 00000000-0000-0000-0000-00000000e022 (from seed_intake_demo.sql)

\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- REPLACE this UUID with the Auth user id after creating the intake login.
-- Leave NULL until then; seed_intake_demo.sql still works for attorney testing.
UPDATE core.staff
SET email = coalesce(nullif(current_setting('app.intake_email', true), ''), email),
    auth_user_id = nullif(current_setting('app.intake_auth_uid', true), '')::uuid,
    role_code = 'intake',
    is_attorney = false,
    active = true
WHERE staff_id = '00000000-0000-0000-0000-00000000e022'
  AND nullif(current_setting('app.intake_auth_uid', true), '') IS NOT NULL;

-- Manual one-shot example (uncomment and set UUID + email):
-- UPDATE core.staff
-- SET auth_user_id = '00000000-0000-0000-0000-000000000000'::uuid,
--     email = 'intake@tuttlelawfirm.com',
--     role_code = 'intake',
--     is_attorney = false,
--     active = true
-- WHERE staff_id = '00000000-0000-0000-0000-00000000e022';

SELECT email, role_code, auth_user_id, active
FROM core.staff
WHERE staff_id = '00000000-0000-0000-0000-00000000e022';

COMMIT;
