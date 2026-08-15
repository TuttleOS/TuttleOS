-- v2.22 — public e-sign over HTTPS (Vercel cannot resolve db.*.supabase.co)
-- Token is the capability, matching get_contract_package_public.
-- SECURITY DEFINER sets app.staff_id so audit.log_change / on_contract_executed
-- can file the executed PDF (document + fee_agreement + matter checklist).

BEGIN;

CREATE OR REPLACE FUNCTION workflow.sign_contract_as_party_public(
  p_token text,
  p_signer_id uuid,
  p_typed_name text,
  p_signature_data text,
  p_ip text DEFAULT NULL,
  p_ua text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pkg workflow.contract_package%ROWTYPE;
  v_signer workflow.contract_signer%ROWTYPE;
  v_actor uuid;
  v_pending int;
  v_signers jsonb;
  v_already boolean;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Link not found');
  END IF;
  IF p_typed_name IS NULL OR length(trim(p_typed_name)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Type your full legal name to sign');
  END IF;
  IF p_signature_data IS NULL
     OR p_signature_data NOT LIKE 'data:image/%'
     OR length(p_signature_data) < 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Please draw your signature before signing');
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
  IF v_pkg.status = 'executed' AND v_pkg.artifact_pdf_base64 IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Contract already fully executed');
  END IF;

  SELECT * INTO v_signer
  FROM workflow.contract_signer s
  WHERE s.contract_signer_id = p_signer_id
    AND s.contract_package_id = v_pkg.contract_package_id
    AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Signer not found');
  END IF;

  v_actor := coalesce(
    v_pkg.created_by,
    '00000000-0000-0000-0000-00000000c0de'::uuid
  );
  PERFORM set_config('app.staff_id', v_actor::text, true);

  v_already := v_signer.status = 'signed';

  SELECT count(*) INTO v_pending
  FROM workflow.contract_signer s
  WHERE s.contract_package_id = v_pkg.contract_package_id
    AND s.deleted_at IS NULL
    AND s.status <> 'signed';

  IF v_already AND v_pending > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', coalesce(nullif(trim(v_signer.full_name), ''), 'This party')
        || ' already signed — pick another name from the list'
    );
  END IF;

  IF NOT v_already THEN
    UPDATE workflow.contract_signer SET
      status = 'signed',
      signed_at = now(),
      signature_typed_name = trim(p_typed_name),
      signature_data = left(p_signature_data, 200000),
      agree_attestation = true,
      ip_address = p_ip,
      user_agent = left(p_ua, 500)
    WHERE contract_signer_id = v_signer.contract_signer_id
      AND status <> 'signed';

    SELECT count(*) INTO v_pending
    FROM workflow.contract_signer s
    WHERE s.contract_package_id = v_pkg.contract_package_id
      AND s.deleted_at IS NULL
      AND s.status <> 'signed';

    UPDATE workflow.contract_package
       SET status = 'partially_signed'
     WHERE contract_package_id = v_pkg.contract_package_id
       AND status <> 'executed';

    INSERT INTO workflow.communication_log
      (intake_lead_id, staff_id, channel, direction, summary)
    VALUES (
      v_pkg.primary_intake_lead_id,
      v_actor,
      'portal',
      'inbound',
      'Contract signed by ' || trim(p_typed_name) || ' (' || v_pending || ' remaining)'
    );
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb)
  INTO v_signers
  FROM (
    SELECT contract_signer_id, full_name, email, status, signed_at,
           signature_typed_name, signature_data, sort_order, intake_lead_id
    FROM workflow.contract_signer
    WHERE contract_package_id = v_pkg.contract_package_id
      AND deleted_at IS NULL
  ) s;

  SELECT * INTO v_pkg
  FROM workflow.contract_package p
  WHERE p.contract_package_id = v_pkg.contract_package_id;

  RETURN jsonb_build_object(
    'ok', true,
    'complete', v_pending = 0,
    'pending_count', v_pending,
    'package', (to_jsonb(v_pkg) - 'artifact_pdf_base64' - 'artifact_html'),
    'signers', v_signers
  );
END;
$$;

CREATE OR REPLACE FUNCTION workflow.finalize_executed_contract_public(
  p_token text,
  p_artifact_html text,
  p_artifact_pdf_base64 text,
  p_pdf_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pkg workflow.contract_package%ROWTYPE;
  v_actor uuid;
  v_pending int;
  v_lead_id uuid;
  v_matter_id uuid;
  v_doc_id uuid;
  v_primary_doc uuid;
  v_today date := CURRENT_DATE;
  v_note_tag text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Link not found');
  END IF;
  IF p_artifact_pdf_base64 IS NULL OR length(p_artifact_pdf_base64) < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Executed PDF missing');
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
  IF v_pkg.status = 'executed' AND v_pkg.artifact_pdf_base64 IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true,
      'primary_document_id', v_pkg.primary_document_id);
  END IF;

  SELECT count(*) INTO v_pending
  FROM workflow.contract_signer s
  WHERE s.contract_package_id = v_pkg.contract_package_id
    AND s.deleted_at IS NULL
    AND s.status <> 'signed';
  IF v_pending > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not all parties have signed');
  END IF;

  v_actor := coalesce(
    v_pkg.created_by,
    '00000000-0000-0000-0000-00000000c0de'::uuid
  );
  PERFORM set_config('app.staff_id', v_actor::text, true);

  v_primary_doc := v_pkg.primary_document_id;
  v_note_tag := 'contract_package_id=' || v_pkg.contract_package_id::text;

  FOR v_lead_id IN
    SELECT DISTINCT lead_id FROM (
      SELECT v_pkg.primary_intake_lead_id AS lead_id
      UNION
      SELECT s.intake_lead_id
      FROM workflow.contract_signer s
      WHERE s.contract_package_id = v_pkg.contract_package_id
        AND s.deleted_at IS NULL
        AND s.intake_lead_id IS NOT NULL
    ) x
  LOOP
    v_matter_id := NULL;
    v_doc_id := NULL;
    SELECT il.resulting_matter_id INTO v_matter_id
    FROM core.intake_lead il
    WHERE il.intake_lead_id = v_lead_id;

    INSERT INTO core.entity (entity_id, entity_type)
    VALUES (v_lead_id, 'intake_lead')
    ON CONFLICT (entity_id) DO NOTHING;

    SELECT d.document_id INTO v_doc_id
    FROM workflow.document d
    WHERE d.entity_id = v_lead_id
      AND d.deleted_at IS NULL
      AND d.notes LIKE v_note_tag || '%'
    LIMIT 1;

    IF v_doc_id IS NULL THEN
      INSERT INTO workflow.document (
        entity_id, client_matter_id, doc_type_code, title, direction,
        status, executed_date, sent_date, notes, hash_sha256
      ) VALUES (
        v_lead_id,
        v_matter_id,
        'contract',
        'Contingent Fee Contract (executed)',
        'outbound',
        'executed',
        v_today,
        v_today,
        v_note_tag || '; pdf_sha_prefix=' || left(coalesce(p_pdf_hash, ''), 16),
        p_pdf_hash
      )
      RETURNING document_id INTO v_doc_id;
    END IF;

    IF v_primary_doc IS NULL THEN
      v_primary_doc := v_doc_id;
    END IF;

    UPDATE core.intake_lead
       SET status = 'signed'
     WHERE intake_lead_id = v_lead_id;

    IF v_matter_id IS NOT NULL AND v_doc_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM finance.fee_agreement fa
         WHERE fa.client_matter_id = v_matter_id
           AND fa.notes LIKE 'From contract package ' || v_pkg.contract_package_id::text || '%'
       )
    THEN
      INSERT INTO finance.fee_agreement (
        client_matter_id, agreement_type, pct_pre_suit, pct_post_filing,
        pct_appeal, executed_date, document_id, notes
      ) VALUES (
        v_matter_id,
        'contingency',
        v_pkg.fee_pre_suit,
        v_pkg.fee_post_filing,
        v_pkg.fee_appeal,
        v_today,
        v_doc_id,
        'From contract package ' || v_pkg.contract_package_id::text
      );
    END IF;
  END LOOP;

  UPDATE workflow.contract_package SET
    status = 'executed',
    executed_at = now(),
    artifact_html = p_artifact_html,
    artifact_pdf_base64 = p_artifact_pdf_base64,
    primary_document_id = v_primary_doc
  WHERE contract_package_id = v_pkg.contract_package_id;

  INSERT INTO workflow.communication_log
    (intake_lead_id, staff_id, channel, direction, summary)
  VALUES (
    v_pkg.primary_intake_lead_id,
    v_actor,
    'portal',
    'outbound',
    'Contract fully executed by all parties — PDF filed to lead/matter profile(s)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'primary_document_id', v_primary_doc
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_contract_as_party_public(
  p_token text,
  p_signer_id uuid,
  p_typed_name text,
  p_signature_data text,
  p_ip text DEFAULT NULL,
  p_ua text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT workflow.sign_contract_as_party_public(
    p_token, p_signer_id, p_typed_name, p_signature_data, p_ip, p_ua
  );
$$;

CREATE OR REPLACE FUNCTION public.finalize_executed_contract_public(
  p_token text,
  p_artifact_html text,
  p_artifact_pdf_base64 text,
  p_pdf_hash text
) RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT workflow.finalize_executed_contract_public(
    p_token, p_artifact_html, p_artifact_pdf_base64, p_pdf_hash
  );
$$;

REVOKE ALL ON FUNCTION workflow.sign_contract_as_party_public(text, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION workflow.finalize_executed_contract_public(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sign_contract_as_party_public(text, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_executed_contract_public(text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION workflow.sign_contract_as_party_public(text, uuid, text, text, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION workflow.finalize_executed_contract_public(text, text, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sign_contract_as_party_public(text, uuid, text, text, text, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_executed_contract_public(text, text, text, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.sign_contract_as_party_public(text, uuid, text, text, text, text) IS
  'Public e-sign: token is the capability. Sets app.staff_id from package.created_by.';
COMMENT ON FUNCTION public.finalize_executed_contract_public(text, text, text, text) IS
  'Public e-sign finalize: files executed PDF after all parties signed.';

COMMIT;
