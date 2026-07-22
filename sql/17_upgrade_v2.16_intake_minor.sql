-- v2.16 — Intake minors: flag + next friend (adult on the case) before convert.
\set ON_ERROR_STOP on

ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false;

ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS not_drivers_child boolean NOT NULL DEFAULT false;

ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS next_friend_person_id uuid
    REFERENCES core.person(person_id);

COMMENT ON COLUMN core.intake_lead.is_minor IS
  'Client is under 18 (from DOB as-of today or staff toggle).';
COMMENT ON COLUMN core.intake_lead.not_drivers_child IS
  'Minor passenger who is not the driver''s child — parent/guardian must sign that minor''s contract.';
COMMENT ON COLUMN core.intake_lead.next_friend_person_id IS
  'Adult on the case (parent/guardian/next friend) for a minor client.';

CREATE INDEX IF NOT EXISTS idx_intake_lead_next_friend
  ON core.intake_lead (next_friend_person_id)
  WHERE deleted_at IS NULL AND next_friend_person_id IS NOT NULL;

ALTER TABLE workflow.contract_signer
  ADD COLUMN IF NOT EXISTS signer_capacity text
    CHECK (
      signer_capacity IS NULL
      OR signer_capacity IN ('client', 'next_friend', 'parent_guardian', 'other')
    );

COMMENT ON COLUMN workflow.contract_signer.signer_capacity IS
  'How this party signs: client, next_friend, parent_guardian, or other.';

ALTER TABLE core.intake_lead
  ADD COLUMN IF NOT EXISTS relationship_to_driver text;

COMMENT ON COLUMN core.intake_lead.relationship_to_driver IS
  'For minors/companions: relationship to the vehicle driver (e.g. child, niece, friend''s child).';
