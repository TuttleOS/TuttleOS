-- Phase 3 deepen — coverage-box N/A declarations (v2.8)
-- Covered boxes are derived from medical.treatment_episode.provider_type;
-- unanswered = neither covered nor declared N/A.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

CREATE TABLE IF NOT EXISTS medical.coverage_na (
  coverage_na_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL
    REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN
    ('ems','hospital_er','urgent_care','chiro','pt','imaging','pain_mgmt','surgical','other')),
  declared_by uuid REFERENCES core.staff(staff_id),
  declared_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE (client_matter_id, category)
);

CREATE INDEX IF NOT EXISTS idx_coverage_na_matter
  ON medical.coverage_na (client_matter_id);

ALTER TABLE medical.coverage_na ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coverage_na_staff ON medical.coverage_na;
CREATE POLICY coverage_na_staff ON medical.coverage_na
  FOR ALL TO app_staff
  USING (app.is_active_staff() AND NOT app.is_intake_only())
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());

GRANT SELECT, INSERT, UPDATE, DELETE ON medical.coverage_na TO app_staff;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical.coverage_na TO authenticated;

COMMIT;
