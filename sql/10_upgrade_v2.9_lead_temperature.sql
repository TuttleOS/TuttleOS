-- v2.9 — Lead temperature (warm / hot / cold) for intake follow-up priority.
-- Michael call B5: indicator near lead name on queue + detail.
\set ON_ERROR_STOP on

ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS lead_temperature text
  CHECK (
    lead_temperature IS NULL
    OR lead_temperature IN ('hot', 'warm', 'cold')
  );

COMMENT ON COLUMN core.intake_lead.lead_temperature IS
  'Intake follow-up priority: hot | warm | cold (nullable = unset)';
