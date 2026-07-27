-- v2.19 — staff multi-role grants + quarantine unused roles (ROLES §8.1#1,#4)
-- Additive. Keeps core.staff.role_code as primary denormalized home role.
-- Paste into Supabase → SQL Editor → Run (or psql -f).

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- ---------------------------------------------------------------------------
-- core.staff_role_grant — many roles per staff; one primary for home routing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.staff_role_grant (
  staff_role_grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES core.staff(staff_id),
  role_code text NOT NULL REFERENCES ref.staff_role(code),
  is_primary boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES core.staff(staff_id),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_role_grant_active
  ON core.staff_role_grant (staff_id, role_code)
  WHERE ended_at IS NULL;

-- At most one primary active grant per staff
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_role_grant_one_primary
  ON core.staff_role_grant (staff_id)
  WHERE ended_at IS NULL AND is_primary;

COMMENT ON TABLE core.staff_role_grant IS
  'Multi-role assignment (e.g. Emily CM + lien). Primary drives homePathForRole. Never use second Auth accounts.';

-- Backfill from existing primary role_code
INSERT INTO core.staff_role_grant (staff_id, role_code, is_primary, granted_by)
SELECT s.staff_id, s.role_code, true, '00000000-0000-0000-0000-00000000c0de'
FROM core.staff s
WHERE s.active
  AND NOT EXISTS (
    SELECT 1 FROM core.staff_role_grant g
    WHERE g.staff_id = s.staff_id
      AND g.role_code = s.role_code
      AND g.ended_at IS NULL
  );

ALTER TABLE core.staff_role_grant ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_read ON core.staff_role_grant;
DROP POLICY IF EXISTS p_ins ON core.staff_role_grant;
DROP POLICY IF EXISTS p_upd ON core.staff_role_grant;
CREATE POLICY p_read ON core.staff_role_grant
  FOR SELECT USING (app.is_active_staff());
CREATE POLICY p_ins ON core.staff_role_grant
  FOR INSERT WITH CHECK (app.is_active_staff());
CREATE POLICY p_upd ON core.staff_role_grant
  FOR UPDATE USING (app.is_active_staff())
  WITH CHECK (app.is_active_staff());

GRANT SELECT, INSERT, UPDATE ON core.staff_role_grant TO authenticated, app_staff;
REVOKE DELETE ON core.staff_role_grant FROM authenticated, app_staff;

-- ---------------------------------------------------------------------------
-- Quarantine: deactivate any records_clerk staff (unused JD — §8.1#4)
-- ---------------------------------------------------------------------------
UPDATE core.staff
SET active = false, updated_at = now()
WHERE role_code = 'records_clerk'
  AND active = true;

-- Gate senior_paralegal † flags off unless already attorney (Pass 1 / §8.1#3)
-- Do NOT strip Michael/attorney flags. Only clear senior_PL without explicit re-grant.
UPDATE core.staff
SET can_approve_level = false,
    can_clear_conflicts = false,
    updated_at = now()
WHERE role_code = 'senior_paralegal'
  AND is_attorney = false;

COMMIT;
