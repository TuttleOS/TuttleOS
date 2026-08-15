-- v2.23 — public executed-PDF fetch (token is the capability)
-- Thanks-page download should not depend on the fat package payload including
-- artifact_pdf_base64, and one next-friend signature is enough (minor does not sign).

BEGIN;

CREATE OR REPLACE FUNCTION workflow.get_executed_contract_pdf_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pkg workflow.contract_package%ROWTYPE;
  v_pending int;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Link not found');
  END IF;

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

  SELECT count(*) INTO v_pending
  FROM workflow.contract_signer s
  WHERE s.contract_package_id = v_pkg.contract_package_id
    AND s.deleted_at IS NULL
    AND s.status <> 'signed';

  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Executed PDF not ready yet');
  END IF;

  IF v_pkg.artifact_pdf_base64 IS NULL OR length(v_pkg.artifact_pdf_base64) < 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Executed PDF not ready yet');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'client_display_names', v_pkg.client_display_names,
    'artifact_pdf_base64', v_pkg.artifact_pdf_base64
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_executed_contract_pdf_public(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT workflow.get_executed_contract_pdf_public(p_token);
$$;

REVOKE ALL ON FUNCTION workflow.get_executed_contract_pdf_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_executed_contract_pdf_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workflow.get_executed_contract_pdf_public(text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_executed_contract_pdf_public(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_executed_contract_pdf_public(text) IS
  'Public e-sign PDF download. Token is the capability; allowed once every required signer has signed.';

COMMIT;
