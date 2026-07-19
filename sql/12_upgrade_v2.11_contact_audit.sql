-- v2.11 — Sensitive contact edits: audit trail on contact_point + history helpers.
-- B6: phone/email changes stay visible; soft-delete of matters/leads is UI-confirmed.
\set ON_ERROR_STOP on

-- Instrument contact_point for immutable audit.change_log (phone/email updates).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_audit_contact_point'
      AND tgrelid = 'core.contact_point'::regclass
  ) THEN
    CREATE TRIGGER trg_audit_contact_point
      AFTER INSERT OR UPDATE OR DELETE ON core.contact_point
      FOR EACH ROW EXECUTE FUNCTION audit.log_change('contact_point_id');
  END IF;
END $$;

COMMENT ON COLUMN core.contact_point.valid_to IS
  'When set, this contact value ended (superseded). UI history shows prior values.';
