-- v2.13 — Firm / attorney countersignature on contingent fee packages.
\set ON_ERROR_STOP on

ALTER TABLE workflow.contract_package
  ADD COLUMN IF NOT EXISTS firm_signature_data text,
  ADD COLUMN IF NOT EXISTS firm_signature_typed_name text,
  ADD COLUMN IF NOT EXISTS firm_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS firm_signed_by uuid REFERENCES core.staff(staff_id);

COMMENT ON COLUMN workflow.contract_package.firm_signature_data IS
  'Drawn PNG data URL for LAW OFFICE countersignature (By: line).';
COMMENT ON COLUMN workflow.contract_package.firm_signed_by IS
  'Staff member who countersigned for Tuttle Law Firm.';
