-- v2.14 — Link intake leads that share one crash (incident_group) before convert.
\set ON_ERROR_STOP on

ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS incident_group_id uuid
    REFERENCES core.incident_group(incident_group_id);

CREATE INDEX IF NOT EXISTS idx_intake_lead_incident_group
  ON core.intake_lead (incident_group_id)
  WHERE deleted_at IS NULL AND incident_group_id IS NOT NULL;

COMMENT ON COLUMN core.intake_lead.incident_group_id IS
  'Shared crash container when multiple people are linked at intake; reused on convert.';
