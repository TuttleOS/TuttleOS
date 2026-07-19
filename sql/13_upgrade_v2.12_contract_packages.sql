-- v2.12 — Contingent fee contract packages (C2 multi-party e-sign).
\set ON_ERROR_STOP on

CREATE TABLE IF NOT EXISTS workflow.contract_package (
  contract_package_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_intake_lead_id uuid NOT NULL REFERENCES core.intake_lead(intake_lead_id),
  public_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','partially_signed','executed','void')),
  client_display_names text NOT NULL,
  incident_location text NOT NULL,
  incident_date date NOT NULL,
  cause_phrase text NOT NULL DEFAULT 'car accident',
  fee_pre_suit numeric(5,2) NOT NULL DEFAULT 40
    CHECK (fee_pre_suit >= 0 AND fee_pre_suit <= 100),
  fee_post_filing numeric(5,2) NOT NULL DEFAULT 45
    CHECK (fee_post_filing >= 0 AND fee_post_filing <= 100),
  fee_appeal numeric(5,2) NOT NULL DEFAULT 50
    CHECK (fee_appeal >= 0 AND fee_appeal <= 100),
  rendered_body text,
  artifact_html text,
  artifact_pdf_base64 text,
  primary_document_id uuid REFERENCES workflow.document(document_id),
  sent_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES core.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contract_package_lead
  ON workflow.contract_package (primary_intake_lead_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contract_package_status
  ON workflow.contract_package (status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS workflow.contract_signer (
  contract_signer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_package_id uuid NOT NULL REFERENCES workflow.contract_package(contract_package_id),
  sort_order int NOT NULL DEFAULT 0,
  full_name text NOT NULL,
  email text,
  phone text,
  intake_lead_id uuid REFERENCES core.intake_lead(intake_lead_id),
  person_id uuid REFERENCES core.person(person_id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','signed')),
  signed_at timestamptz,
  signature_data text,
  signature_typed_name text,
  agree_attestation boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contract_signer_package
  ON workflow.contract_signer (contract_package_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_contract_package_touch ON workflow.contract_package;
CREATE TRIGGER trg_contract_package_touch
  BEFORE UPDATE ON workflow.contract_package
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

DROP TRIGGER IF EXISTS trg_contract_signer_touch ON workflow.contract_signer;
CREATE TRIGGER trg_contract_signer_touch
  BEFORE UPDATE ON workflow.contract_signer
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

ALTER TABLE workflow.contract_package ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.contract_signer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_read ON workflow.contract_package;
DROP POLICY IF EXISTS p_ins ON workflow.contract_package;
DROP POLICY IF EXISTS p_upd ON workflow.contract_package;
CREATE POLICY p_read ON workflow.contract_package FOR SELECT USING (app.is_active_staff());
CREATE POLICY p_ins ON workflow.contract_package FOR INSERT WITH CHECK (app.is_active_staff());
CREATE POLICY p_upd ON workflow.contract_package FOR UPDATE USING (app.is_active_staff()) WITH CHECK (app.is_active_staff());

DROP POLICY IF EXISTS p_read ON workflow.contract_signer;
DROP POLICY IF EXISTS p_ins ON workflow.contract_signer;
DROP POLICY IF EXISTS p_upd ON workflow.contract_signer;
CREATE POLICY p_read ON workflow.contract_signer FOR SELECT USING (app.is_active_staff());
CREATE POLICY p_ins ON workflow.contract_signer FOR INSERT WITH CHECK (app.is_active_staff());
CREATE POLICY p_upd ON workflow.contract_signer FOR UPDATE USING (app.is_active_staff()) WITH CHECK (app.is_active_staff());

GRANT SELECT, INSERT, UPDATE ON workflow.contract_package TO authenticated;
GRANT SELECT, INSERT, UPDATE ON workflow.contract_signer TO authenticated;
GRANT ALL ON workflow.contract_package TO service_role;
GRANT ALL ON workflow.contract_signer TO service_role;

-- Public e-sign helpers (no staff JWT). Token is the capability.
CREATE OR REPLACE FUNCTION workflow.get_contract_package_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pkg workflow.contract_package%ROWTYPE;
  v_signers jsonb;
BEGIN
  SELECT * INTO v_pkg
  FROM workflow.contract_package p
  WHERE p.public_token = p_token
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Link not found');
  END IF;
  IF v_pkg.status = 'void' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This link has been voided');
  END IF;
  IF v_pkg.expires_at IS NOT NULL AND v_pkg.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This link has expired');
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
  INTO v_signers
  FROM (
    SELECT contract_signer_id, full_name, email, status, signed_at,
           signature_typed_name, sort_order
    FROM workflow.contract_signer
    WHERE contract_package_id = v_pkg.contract_package_id
      AND deleted_at IS NULL
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'package', to_jsonb(v_pkg),
    'signers', v_signers
  );
END;
$$;

REVOKE ALL ON FUNCTION workflow.get_contract_package_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow.get_contract_package_public(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_contract_package_public(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT workflow.get_contract_package_public(p_token);
$$;

REVOKE ALL ON FUNCTION public.get_contract_package_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contract_package_public(text) TO anon, authenticated, service_role;

COMMENT ON TABLE workflow.contract_package IS
  'C2 multi-party contingent fee packet; PDF filed only when status=executed (all signers done).';

