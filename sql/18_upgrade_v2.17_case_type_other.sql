-- v2.17 — free-text cause when case type is "other" (contract merge)
ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS case_type_other text;

COMMENT ON COLUMN core.intake_lead.case_type_other IS
  'When case_type_code = other, staff free-text for the cause of action (pulls into contingent fee contract).';
