-- ================================================================================
-- TUTTLE OS — v2.5 ROLLBACK: reverses the naming sweep (renames back, restores
-- the pre-v2.5 function bodies and view definitions verbatim).
-- ================================================================================
BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

DROP VIEW IF EXISTS workflow.v_stalled_cases;
DROP VIEW IF EXISTS resolution.v_demand_readiness;
DROP VIEW IF EXISTS property.v_pd_aging;
DROP VIEW IF EXISTS liens.v_lien_worklist;
DROP VIEW IF EXISTS insurance.v_claim_adjuster_roster;
DROP VIEW IF EXISTS core.v_sol_reconciliation;
DROP VIEW IF EXISTS core.v_matter_role_gaps;
ALTER TABLE workflow.deadline RENAME COLUMN satisfied_date TO satisfied_at;
ALTER TABLE workflow.public_records_request RENAME COLUMN response_received_date TO response_received;
ALTER TABLE resolution.demand RENAME COLUMN response_received_date TO response_received;
ALTER TABLE medical.treatment_episode RENAME COLUMN projected_completion_date TO projected_completion;
ALTER TABLE medical.treatment_episode RENAME COLUMN last_visit_date TO last_visit;
ALTER TABLE medical.treatment_episode RENAME COLUMN first_visit_date TO first_visit;
ALTER TABLE medical.provider_contact_log RENAME COLUMN next_appointment_date TO next_appointment;
ALTER TABLE litigation.trial_witness RENAME COLUMN subpoena_served_date TO subpoena_served;
ALTER TABLE litigation.trial_witness RENAME COLUMN subpoena_issued_date TO subpoena_issued;
ALTER TABLE litigation.service_of_process RENAME COLUMN rule_106_order_signed_date TO rule_106_order_signed;
ALTER TABLE litigation.service_of_process RENAME COLUMN rule_106_motion_filed_date TO rule_106_motion_filed;
ALTER TABLE litigation.service_of_process RENAME COLUMN citation_issued_date TO citation_issued;
ALTER TABLE litigation.service_of_process RENAME COLUMN citation_requested_date TO citation_requested;
ALTER TABLE litigation.scheduling_order RENAME COLUMN pretrial_disclosures_deadline TO pretrial_disclosures_due;
ALTER TABLE litigation.scheduling_order RENAME COLUMN discovery_close_date TO discovery_close;
ALTER TABLE litigation.scheduling_order RENAME COLUMN expert_designation_defense_date TO expert_designation_defense;
ALTER TABLE litigation.scheduling_order RENAME COLUMN expert_designation_plaintiff_date TO expert_designation_plaintiff;
ALTER TABLE litigation.motion RENAME COLUMN response_filed_date TO response_filed;
ALTER TABLE litigation.motion RENAME COLUMN reply_filed_date TO reply_filed;
ALTER TABLE litigation.lit_party RENAME COLUMN answer_filed_date TO answer_filed;
ALTER TABLE litigation.expert RENAME COLUMN report_served_date TO report_served;
ALTER TABLE litigation.expert RENAME COLUMN challenge_motion_filed_date TO challenge_motion_filed;
ALTER TABLE litigation.discovery_set RENAME COLUMN extension_agreed_date TO extension_agreed_to;
ALTER TABLE litigation.discovery_set RENAME COLUMN responses_served_date TO responses_served;
ALTER TABLE litigation.deposition RENAME COLUMN transcript_received_date TO transcript_received;
ALTER TABLE litigation.deposition RENAME COLUMN notice_served_date TO notice_served;
ALTER TABLE litigation.court_case RENAME COLUMN remand_motion_filed_date TO remand_motion_filed;
ALTER TABLE litigation.court_case RENAME COLUMN bifurcation_motion_filed_date TO bifurcation_motion_filed;
ALTER TABLE liens.medicare_detail RENAME COLUMN rights_and_responsibilities_received_date TO rights_and_responsibilities_received;
ALTER TABLE insurance.policy RENAME COLUMN dec_sheet_requested_date TO dec_sheet_requested;
ALTER TABLE insurance.policy RENAME COLUMN dec_sheet_received_date TO dec_sheet_received;
ALTER TABLE insurance.claim RENAME COLUMN policy_limits_request_sent_date TO policy_limits_request_sent;
ALTER TABLE insurance.claim RENAME COLUMN policy_limits_disclosed_date TO policy_limits_disclosed;
ALTER TABLE insurance.claim RENAME COLUMN lor_sent_date TO lor_sent;
ALTER TABLE insurance.claim RENAME COLUMN reported_date TO date_reported;
ALTER TABLE core.limitations_analysis RENAME COLUMN medmal_notice_sent_date TO medmal_notice_sent;
ALTER TABLE core.limitations_analysis RENAME COLUMN ttca_notice_sent_date TO ttca_notice_sent;
ALTER TABLE core.limitations_analysis RENAME COLUMN charter_notice_sent_date TO charter_notice_sent;
ALTER TABLE core.intake_lead RENAME COLUMN non_engagement_letter_sent_date TO non_engagement_letter_sent;
ALTER TABLE core.incident_group RENAME COLUMN preservation_letter_sent_date TO preservation_letter_sent;
ALTER TABLE analytics.closed_case_snapshot RENAME COLUMN case_type_code TO case_type;
ALTER TABLE litigation.service_of_process RENAME COLUMN service_of_process_id TO service_id;
ALTER TABLE medical.clinical_event RENAME COLUMN description TO detail;
ALTER TABLE workflow.task RENAME COLUMN description TO detail;
ALTER TABLE core.client_matter RENAME COLUMN current_stage_code TO current_stage;
ALTER TABLE insurance.coverage_assessment RENAME COLUMN followup_owner_staff_id TO coverage_followup_owner;
ALTER TABLE workflow.viability_review RENAME COLUMN reviewed_by TO reviewer_id;
ALTER TABLE liens.lien_event RENAME COLUMN logged_by TO by_staff_id;
ALTER TABLE insurance.claim_adjuster RENAME COLUMN end_date TO ended_at;
ALTER TABLE insurance.claim_adjuster RENAME COLUMN start_date TO started_at;
ALTER TABLE litigation.affidavit_18001_party RENAME COLUMN counter_affidavit_received_date TO counter_affidavit_received;
ALTER TABLE litigation.affidavit_18001_party RENAME COLUMN served_date TO served_on_date;
ALTER TABLE litigation.affidavit_18001_party RENAME COLUMN service_due TO our_service_due;
ALTER TABLE medical.affidavit_18001 RENAME COLUMN counter_affidavit_received_date TO counter_affidavit_received;
ALTER TABLE medical.affidavit_18001 RENAME COLUMN counter_affidavit_due TO counter_deadline;
ALTER TABLE medical.affidavit_18001 RENAME COLUMN service_due TO service_deadline;
CREATE OR REPLACE FUNCTION analytics.finalize_matter_close(p_matter uuid)
 RETURNS void
 LANGUAGE sql
AS $function$
INSERT INTO analytics.closed_case_snapshot (
  client_matter_id, case_type, county, venue_county, case_manager,
  disposition, settled_stage, date_of_loss, sign_up_date, close_date,
  days_signup_to_close, approved_level, policy_dinsco_limits,
  gross_recovery, attorney_fee, total_expenses,
  total_medical_billed, total_liens_asserted, total_liens_final,
  lien_reduction_pct, net_to_client,
  had_surgery, had_injections, had_mri,
  commercial_defendant, litigation_filed,
  intake_source, referral_source, marketing_source)
SELECT
  m.client_matter_id, ig.case_type_code, ig.incident_county, ig.likely_venue_county,
  (SELECT p2.first_name || ' ' || p2.last_name
     FROM core.staff_assignment sa
     JOIN core.staff s ON s.staff_id = sa.staff_id
     JOIN core.person p2 ON p2.person_id = s.person_id
    WHERE sa.client_matter_id = m.client_matter_id
      AND sa.assignment_role = 'case_manager'
    ORDER BY sa.assigned_at DESC LIMIT 1),
  m.disposition,
  (SELECT st.settled_stage FROM resolution.settlement st
    WHERE st.client_matter_id = m.client_matter_id
    ORDER BY st.agreed_date DESC LIMIT 1),
  ig.date_of_loss, m.sign_up_date, m.close_date,
  (m.close_date - m.sign_up_date),
  m.approved_level,
  (SELECT ca.dinsco_confirmed_limits FROM insurance.coverage_assessment ca
    WHERE ca.client_matter_id = m.client_matter_id),
  coalesce((SELECT sum(st.gross_amount) FROM resolution.settlement st
    WHERE st.client_matter_id = m.client_matter_id), 0),
  coalesce((SELECT sum(ds.attorney_fee) FROM finance.disbursement_statement ds
    WHERE ds.client_matter_id = m.client_matter_id AND ds.status = 'complete'), 0),
  coalesce((SELECT sum(ce.amount) FROM finance.case_expense ce
    WHERE ce.client_matter_id = m.client_matter_id), 0),
  coalesce((SELECT sum(b.total_billed) FROM medical.bill b
    JOIN medical.treatment_episode te ON te.treatment_episode_id = b.treatment_episode_id
    WHERE te.client_matter_id = m.client_matter_id), 0),
  coalesce((SELECT sum(l.asserted_amount) FROM liens.lien l
    WHERE l.client_matter_id = m.client_matter_id), 0),
  coalesce((SELECT sum(l.final_amount) FROM liens.lien l
    WHERE l.client_matter_id = m.client_matter_id), 0),
  CASE WHEN coalesce((SELECT sum(l.asserted_amount) FROM liens.lien l
                       WHERE l.client_matter_id = m.client_matter_id), 0) > 0
       THEN round(100 * (1 - coalesce((SELECT sum(l.final_amount) FROM liens.lien l
                                        WHERE l.client_matter_id = m.client_matter_id), 0)
                / (SELECT sum(l.asserted_amount) FROM liens.lien l
                    WHERE l.client_matter_id = m.client_matter_id)), 2) END,
  coalesce((SELECT sum(ds.net_to_client) FROM finance.disbursement_statement ds
    WHERE ds.client_matter_id = m.client_matter_id AND ds.status = 'complete'), 0),
  EXISTS (SELECT 1 FROM medical.clinical_event ce WHERE ce.client_matter_id = m.client_matter_id
           AND ce.event_type_code = 'surgery' AND ce.completed),
  EXISTS (SELECT 1 FROM medical.clinical_event ce WHERE ce.client_matter_id = m.client_matter_id
           AND ce.event_type_code IN ('tpi','esi','mbb') AND ce.completed),
  EXISTS (SELECT 1 FROM medical.clinical_event ce WHERE ce.client_matter_id = m.client_matter_id
           AND ce.event_type_code = 'mri' AND ce.completed),
  ig.commercial_vehicle OR ig.trucking_fmcsr,
  EXISTS (SELECT 1 FROM litigation.court_case cc WHERE cc.client_matter_id = m.client_matter_id),
  m.intake_source, m.referral_source, m.marketing_source
FROM core.client_matter m
JOIN core.incident_group ig ON ig.incident_group_id = m.incident_group_id
WHERE m.client_matter_id = p_matter
ON CONFLICT (client_matter_id) DO NOTHING;
$function$;
CREATE OR REPLACE FUNCTION core.quick_search(q text, max_rows integer DEFAULT 20)
 RETURNS TABLE(result_type text, result_id uuid, label text, sublabel text, rank real)
 LANGUAGE sql
 STABLE
AS $function$
  WITH needle AS (SELECT '%' || q || '%' AS pat)
  (SELECT 'person' AS result_type, p.person_id AS result_id,
          p.last_name || ', ' || p.first_name AS label,
          coalesce('DOB ' || to_char(p.date_of_birth,'MM/DD/YYYY'), '') AS sublabel,
          similarity(p.last_name || ' ' || p.first_name, q) AS rank
     FROM core.person p, needle n
    WHERE p.deleted_at IS NULL
      AND (p.last_name || ' ' || p.first_name || ' ' || coalesce(p.middle_name,'')
           || ' ' || coalesce(p.goes_by,'')) ILIKE n.pat)
  UNION ALL
  (SELECT 'organization', o.organization_id, o.name, o.org_type,
          similarity(o.name, q)
     FROM core.organization o, needle n
    WHERE o.deleted_at IS NULL AND o.name ILIKE n.pat)
  UNION ALL
  (SELECT 'client_matter', m.client_matter_id,
          core.matter_display_name(m.client_matter_id),
          coalesce(m.matter_number,'') || ' · ' || m.current_stage,
          greatest(similarity(coalesce(m.matter_number,''), q),
                   similarity(pp.last_name || ' ' || pp.first_name, q))
     FROM core.client_matter m
     JOIN core.person pp ON pp.person_id = m.client_person_id, needle n
    WHERE m.deleted_at IS NULL
      AND (coalesce(m.matter_number,'') ILIKE n.pat
           OR (pp.last_name || ' ' || pp.first_name) ILIKE n.pat))
  UNION ALL
  (SELECT 'court_case', c.court_case_id,
          coalesce(c.cause_number,'(no cause no.)'),
          coalesce(c.style,''),
          similarity(coalesce(c.cause_number,'') || ' ' || coalesce(c.style,''), q)
     FROM litigation.court_case c, needle n
    WHERE c.deleted_at IS NULL
      AND (coalesce(c.cause_number,'') ILIKE n.pat OR coalesce(c.style,'') ILIKE n.pat))
  ORDER BY rank DESC NULLS LAST, label
  LIMIT max_rows;
$function$;
CREATE OR REPLACE FUNCTION core.sync_stage_entered()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    NEW.stage_entered_at := now();
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION core.sync_stage_history()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    UPDATE core.stage_history
       SET exited_at = now()
     WHERE client_matter_id = NEW.client_matter_id AND exited_at IS NULL;
    INSERT INTO core.stage_history (client_matter_id, stage_code)
    VALUES (NEW.client_matter_id, NEW.current_stage);
  END IF;
  RETURN NULL;
END $function$;
CREATE OR REPLACE FUNCTION insurance.on_lor_sent()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE v_pattern text;
BEGIN
  IF NEW.lor_sent IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.lor_sent IS DISTINCT FROM NEW.lor_sent)
     AND NEW.client_matter_id IS NOT NULL THEN
    v_pattern := CASE
      WHEN NEW.claim_role IN ('dinsco_liability','pd_dinsco','umbrella') THEN 'Send DINSCO LOR%'
      WHEN NEW.claim_role IN ('pinsco_liability','pip','um_uim','medpay','pd_pinsco') THEN 'Send PINSCO LOR%'
      ELSE NULL END;
    IF v_pattern IS NOT NULL THEN
      UPDATE workflow.task
         SET status = 'done', completed_at = now(),
             completed_by = app.current_staff_id(),
             completion_method = 'system'
       WHERE client_matter_id = NEW.client_matter_id
         AND status IN ('open','in_progress')
         AND trigger_source = 'contract_signed'
         AND title ILIKE v_pattern;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION litigation.apply_scheduling_order(p_order uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  so litigation.scheduling_order;
  v_matter uuid;
  v_created int := 0;
  r record;
BEGIN
  SELECT * INTO so FROM litigation.scheduling_order WHERE scheduling_order_id = p_order;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown scheduling order %', p_order; END IF;
  SELECT client_matter_id INTO v_matter
    FROM litigation.court_case WHERE court_case_id = so.court_case_id;

  -- 1) vacate PENDING rule-based deadlines this order covers, and pending
  --    deadlines from earlier scheduling orders on the same case
  UPDATE workflow.deadline d
     SET status = 'vacated',
         adjusted_reason = coalesce(adjusted_reason,'')
           || ' superseded by scheduling order signed ' || so.signed_date
   WHERE d.status = 'pending'
     AND d.client_matter_id = v_matter
     AND ( (d.source = 'rule' AND d.rule_code IN
             ('expert_desig_p_90','expert_desig_d_60',
              'pretrial_disclosures_30','msj_notice_21'))
        OR (d.source = 'court_order'
            AND d.scheduling_order_id IS DISTINCT FROM p_order) );

  -- 1b) v2.4 — Michael's 18.001 rule: a court-ordered 18.001 date supersedes
  --     EVERY per-answer statutory serve clock, however many defendants have
  --     answered. Order silent on 18.001 → statutory clocks stand untouched.
  IF so.affidavit_18001_deadline IS NOT NULL THEN
    UPDATE workflow.deadline d
       SET status = 'vacated',
           adjusted_reason = coalesce(adjusted_reason,'')
             || ' superseded by court-ordered 18.001 date '
             || so.affidavit_18001_deadline || ' (order signed ' || so.signed_date || ')'
     WHERE d.status = 'pending'
       AND d.client_matter_id = v_matter
       AND d.source = 'rule'
       AND d.rule_code = 'affidavit_18001_serve_90';
  END IF;

  -- counter watches fall only to a court-ordered COUNTER deadline
  IF so.counter_affidavit_deadline IS NOT NULL THEN
    UPDATE workflow.deadline d
       SET status = 'vacated',
           adjusted_reason = coalesce(adjusted_reason,'')
             || ' superseded by court-ordered counter-affidavit date '
             || so.counter_affidavit_deadline || ' (order signed ' || so.signed_date || ')'
     WHERE d.status = 'pending'
       AND d.client_matter_id = v_matter
       AND d.source = 'rule'
       AND d.rule_code = 'affidavit_18001_counter_120';
  END IF;

  -- 2) create court_order deadlines from every date the order sets
  FOR r IN SELECT * FROM (VALUES
      ('Pleadings amendment deadline (DCO)', so.pleadings_amendment_deadline, NULL::text),
      ('Plaintiff expert designation (DCO)', so.expert_designation_plaintiff, NULL),
      ('Defense expert designation (DCO)',   so.expert_designation_defense,   NULL),
      ('Expert challenge deadline (DCO)',    so.expert_challenge_deadline,    NULL),
      ('Serve § 18.001 affidavits (DCO — supersedes per-answer clocks)',
                                             so.affidavit_18001_deadline,     'affidavit_18001_serve_90'),
      ('Counter-affidavit deadline (DCO)',   so.counter_affidavit_deadline,   'affidavit_18001_counter_120'),
      ('Discovery closes (DCO)',             so.discovery_close,              NULL),
      ('Dispositive motion deadline (DCO)',  so.dispositive_motion_deadline,  NULL),
      ('Mediation deadline (DCO)',           so.mediation_deadline,           NULL),
      ('Pretrial disclosures due (DCO)',     so.pretrial_disclosures_due,     NULL),
      ('Trial date (DCO)',                   so.trial_date,                   NULL)
    ) AS t(label, d, rc) WHERE t.d IS NOT NULL
  LOOP
    INSERT INTO workflow.deadline
      (entity_id, client_matter_id, rule_code, label, base_event, base_date,
       computed_date, effective_date, source, scheduling_order_id)
    VALUES
      (so.court_case_id, v_matter, r.rc, r.label, 'scheduling order', so.signed_date,
       r.d, r.d, 'court_order', p_order);
    v_created := v_created + 1;
  END LOOP;

  -- keep the case's discovery-period end in sync when the order sets it
  IF so.discovery_close IS NOT NULL THEN
    UPDATE litigation.court_case
       SET discovery_period_end = so.discovery_close,
           dco_signed_date = so.signed_date,
           dco_document_id = coalesce(so.document_id, dco_document_id)
     WHERE court_case_id = so.court_case_id;
  END IF;
  RETURN v_created;
END $function$;
CREATE OR REPLACE FUNCTION litigation.on_answer_filed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_matter uuid;
BEGIN
  IF NEW.answer_filed IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.answer_filed IS NOT DISTINCT FROM NEW.answer_filed THEN RETURN NEW; END IF;
  IF NEW.alignment NOT IN ('defendant','third_party_defendant','counter_defendant') THEN RETURN NEW; END IF;

  SELECT cc.client_matter_id INTO v_matter
    FROM litigation.court_case cc WHERE cc.court_case_id = NEW.court_case_id;

  -- serve clock: only if NO court-ordered 18.001 date already controls the case
  IF NOT EXISTS (SELECT 1 FROM workflow.deadline d
                  WHERE d.client_matter_id = v_matter AND d.status = 'pending'
                    AND d.source = 'court_order' AND d.rule_code = 'affidavit_18001_serve_90') THEN
    INSERT INTO workflow.deadline
      (entity_id, client_matter_id, rule_code, label, base_event, base_date,
       computed_date, effective_date, source, jurisdictional)
    SELECT NEW.lit_party_id, v_matter, 'affidavit_18001_serve_90',
           'Serve § 18.001 affidavits — ' || coalesce(NEW.pleaded_name,'defendant')
             || ' (90d after its answer; earlier-of expert designation — ATTORNEY-VERIFY)',
           'answer filed', NEW.answer_filed,
           NEW.answer_filed + 90, NEW.answer_filed + 90, 'rule', false
    WHERE NOT EXISTS (SELECT 1 FROM workflow.deadline d
                       WHERE d.entity_id = NEW.lit_party_id AND d.status = 'pending'
                         AND d.rule_code = 'affidavit_18001_serve_90');
  END IF;

  -- counter watch: independent; only a court-ordered COUNTER date suppresses it
  IF NOT EXISTS (SELECT 1 FROM workflow.deadline d
                  WHERE d.client_matter_id = v_matter AND d.status = 'pending'
                    AND d.source = 'court_order' AND d.rule_code = 'affidavit_18001_counter_120') THEN
    INSERT INTO workflow.deadline
      (entity_id, client_matter_id, rule_code, label, base_event, base_date,
       computed_date, effective_date, source, jurisdictional)
    SELECT NEW.lit_party_id, v_matter, 'affidavit_18001_counter_120',
           'Counter-affidavit window closes — ' || coalesce(NEW.pleaded_name,'defendant')
             || ' (defense deadline — watch: silence locks in our affidavits)',
           'answer filed', NEW.answer_filed,
           NEW.answer_filed + 120, NEW.answer_filed + 120, 'rule', false
    WHERE NOT EXISTS (SELECT 1 FROM workflow.deadline d
                       WHERE d.entity_id = NEW.lit_party_id AND d.status = 'pending'
                         AND d.rule_code = 'affidavit_18001_counter_120');
  END IF;

  RETURN NEW;
END $function$;
CREATE VIEW core.v_matter_role_gaps WITH (security_invoker=on) AS
 SELECT cm.client_matter_id,
    cm.casepeer_case_id,
    (p.last_name || ', '::text) || p.first_name AS client,
    cm.current_stage,
    NOT (EXISTS ( SELECT 1
           FROM core.staff_assignment sa
          WHERE sa.client_matter_id = cm.client_matter_id AND sa.assignment_role = 'case_manager'::text AND sa.ended_at IS NULL)) AS missing_case_manager,
    NOT (EXISTS ( SELECT 1
           FROM core.staff_assignment sa
          WHERE sa.client_matter_id = cm.client_matter_id AND (sa.assignment_role = ANY (ARRAY['paralegal'::text, 'litigation_paralegal'::text])) AND sa.ended_at IS NULL)) AS missing_paralegal
   FROM core.client_matter cm
     JOIN core.person p ON p.person_id = cm.client_person_id
  WHERE cm.deleted_at IS NULL AND cm.representation_status = 'active'::text AND (NOT (EXISTS ( SELECT 1
           FROM core.staff_assignment sa
          WHERE sa.client_matter_id = cm.client_matter_id AND sa.assignment_role = 'case_manager'::text AND sa.ended_at IS NULL)) OR NOT (EXISTS ( SELECT 1
           FROM core.staff_assignment sa
          WHERE sa.client_matter_id = cm.client_matter_id AND (sa.assignment_role = ANY (ARRAY['paralegal'::text, 'litigation_paralegal'::text])) AND sa.ended_at IS NULL)));
GRANT SELECT ON core.v_matter_role_gaps TO app_staff;
CREATE VIEW core.v_sol_reconciliation WITH (security_invoker=on) AS
 SELECT cm.client_matter_id,
    cm.casepeer_case_id,
    (p.last_name || ', '::text) || p.first_name AS client,
    cm.current_stage,
    cm.sol_date AS stored_sol,
    la.computed_sol_date AS computed_sol,
    cm.sol_date - la.computed_sol_date AS delta_days,
        CASE
            WHEN la.computed_sol_date IS NULL THEN 'no_computation'::text
            WHEN cm.sol_date IS NULL THEN 'no_stored_value'::text
            WHEN cm.sol_date = la.computed_sol_date THEN 'match'::text
            WHEN cm.sol_date > la.computed_sol_date THEN 'STORED_LATER_REVIEW_tolling_or_error'::text
            ELSE 'stored_earlier_conservative'::text
        END AS reconciliation,
    cm.sol_status
   FROM core.client_matter cm
     JOIN core.person p ON p.person_id = cm.client_person_id
     LEFT JOIN core.limitations_analysis la USING (client_matter_id)
  WHERE cm.deleted_at IS NULL;
GRANT INSERT ON core.v_sol_reconciliation TO app_staff;
GRANT SELECT ON core.v_sol_reconciliation TO app_staff;
GRANT UPDATE ON core.v_sol_reconciliation TO app_staff;
CREATE VIEW insurance.v_claim_adjuster_roster WITH (security_invoker=on) AS
 SELECT ca.claim_id,
    c.claim_number,
    c.claim_role,
    ca.adjuster_role,
    ca.display_name,
    ca.phone,
    ca.phone_extension,
    ca.email,
    ca.started_at
   FROM insurance.claim_adjuster ca
     JOIN insurance.claim c USING (claim_id)
  WHERE ca.is_current AND ca.deleted_at IS NULL
  ORDER BY c.claim_number, ca.adjuster_role;
GRANT SELECT ON insurance.v_claim_adjuster_roster TO app_staff;
CREATE VIEW liens.v_lien_worklist WITH (security_invoker=on) AS
 SELECT l.lien_id,
    l.client_matter_id,
    core.matter_display_name(l.client_matter_id) AS display_name,
    lt.label AS lien_type,
    o.name AS holder,
    l.status,
    l.asserted_amount,
    l.verified_amount,
    l.negotiated_amount,
    l.flagged_for_resolution_date,
    l.owner_staff_id,
    m.current_stage,
    (EXISTS ( SELECT 1
           FROM resolution.settlement s
          WHERE s.client_matter_id = l.client_matter_id)) AS matter_settled
   FROM liens.lien l
     JOIN ref.lien_type lt ON lt.code = l.lien_type_code
     JOIN core.client_matter m ON m.client_matter_id = l.client_matter_id
     LEFT JOIN core.organization o ON o.organization_id = l.holder_org_id
  WHERE (l.status <> ALL (ARRAY['resolved'::text, 'waived'::text, 'not_applicable'::text])) AND l.deleted_at IS NULL
  ORDER BY ((EXISTS ( SELECT 1
           FROM resolution.settlement s
          WHERE s.client_matter_id = l.client_matter_id))) DESC, l.flagged_for_resolution_date;
GRANT INSERT ON liens.v_lien_worklist TO app_staff;
GRANT SELECT ON liens.v_lien_worklist TO app_staff;
GRANT UPDATE ON liens.v_lien_worklist TO app_staff;
CREATE VIEW property.v_pd_aging WITH (security_invoker=on) AS
 SELECT pd.pd_claim_id,
    v.incident_group_id,
    v.year,
    v.make,
    v.model,
    pd.status,
    pd.owner_staff_id,
    pd.opened_date,
    pd.last_touch_date,
    CURRENT_DATE - pd.last_touch_date AS days_since_touch,
    pd.repairable_or_total,
    pd.valuation_received,
    pd.valuation_reviewed,
    pd.lienholder_resolved,
    pd.loss_of_use_pursued,
    pd.diminished_value_evaluated,
    pd.demand_blocker,
    v.storage_accruing,
    (EXISTS ( SELECT 1
           FROM core.client_matter m
          WHERE m.incident_group_id = v.incident_group_id AND m.deleted_at IS NULL AND (m.current_stage = ANY (ARRAY['demand'::text, 'negotiation'::text])))) AS matter_at_demand_stage
   FROM property.pd_claim pd
     JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
  WHERE pd.status <> ALL (ARRAY['resolved'::text, 'n_a'::text])
  ORDER BY ((EXISTS ( SELECT 1
           FROM core.client_matter m
          WHERE m.incident_group_id = v.incident_group_id AND m.deleted_at IS NULL AND (m.current_stage = ANY (ARRAY['demand'::text, 'negotiation'::text]))))) DESC, (CURRENT_DATE - pd.last_touch_date) DESC NULLS LAST;
GRANT INSERT ON property.v_pd_aging TO app_staff;
GRANT SELECT ON property.v_pd_aging TO app_staff;
GRANT UPDATE ON property.v_pd_aging TO app_staff;
CREATE VIEW resolution.v_demand_readiness WITH (security_invoker=on) AS
 SELECT m.client_matter_id,
    core.matter_display_name(m.client_matter_id) AS display_name,
    m.approved_level,
    bool_and(te.status = ANY (ARRAY['completed'::text, 'cut_off'::text, 'discharged'::text, 'never_treated'::text])) FILTER (WHERE te.treatment_episode_id IS NOT NULL) AS treatment_complete,
    count(rr.record_request_id) FILTER (WHERE rr.status <> ALL (ARRAY['received'::text, 'cancelled'::text])) AS records_outstanding,
    NOT (EXISTS ( SELECT 1
           FROM property.pd_claim pd
             JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
          WHERE v.incident_group_id = m.incident_group_id AND (pd.status <> ALL (ARRAY['resolved'::text, 'n_a'::text])))) AS pd_clear,
    d.demand_id,
    d.reviewed_at IS NOT NULL AS kate_reviewed,
    m.approved_level = 3 AS needs_attorney_approval,
    d.attorney_approved_at IS NOT NULL AS attorney_approved
   FROM core.client_matter m
     LEFT JOIN medical.treatment_episode te ON te.client_matter_id = m.client_matter_id
     LEFT JOIN medical.record_request rr ON rr.treatment_episode_id = te.treatment_episode_id
     LEFT JOIN resolution.demand d ON d.client_matter_id = m.client_matter_id AND d.sent_date IS NULL
  WHERE m.deleted_at IS NULL AND (m.current_stage = ANY (ARRAY['records'::text, 'demand'::text]))
  GROUP BY m.client_matter_id, d.demand_id, d.reviewed_at, d.attorney_approved_at, m.approved_level;
GRANT INSERT ON resolution.v_demand_readiness TO app_staff;
GRANT SELECT ON resolution.v_demand_readiness TO app_staff;
GRANT UPDATE ON resolution.v_demand_readiness TO app_staff;
CREATE VIEW workflow.v_stalled_cases WITH (security_invoker=on) AS
 SELECT client_matter_id,
    core.matter_display_name(client_matter_id) AS display_name,
    current_stage,
    stage_entered_at,
    ( SELECT s.email
           FROM core.staff_assignment sa
             JOIN core.staff s ON s.staff_id = sa.staff_id
          WHERE sa.client_matter_id = m.client_matter_id AND sa.assignment_role = 'case_manager'::text AND sa.ended_at IS NULL
         LIMIT 1) AS case_manager,
    CURRENT_DATE - sign_up_date AS case_age_days,
    (EXTRACT(epoch FROM now() - stage_entered_at) / 86400::numeric)::integer AS days_in_stage,
    ( SELECT n.body
           FROM workflow.note n
          WHERE n.entity_id = m.client_matter_id AND n.pinned AND n.deleted_at IS NULL
          ORDER BY n.created_at DESC
         LIMIT 1) AS critical_note,
    (EXISTS ( SELECT 1
           FROM medical.injury i
          WHERE i.client_matter_id = m.client_matter_id AND i.is_tbi)) AS tbi_indicated,
    approved_level,
    approved_level IS NULL AND sign_up_date IS NOT NULL AND (sign_up_date + 7) < CURRENT_DATE AS flag_missing_level,
    (EXISTS ( SELECT 1
           FROM workflow.viability_review vr
          WHERE vr.client_matter_id = m.client_matter_id AND vr.reviewed_at IS NULL AND vr.due_date < CURRENT_DATE)) AS flag_viability_overdue,
    COALESCE(( SELECT max(cl.occurred_at) AS max
           FROM workflow.communication_log cl
          WHERE cl.client_matter_id = m.client_matter_id AND cl.person_id = m.client_person_id), created_at) < (now() - '30 days'::interval) AS flag_no_client_contact_30d,
    (EXISTS ( SELECT 1
           FROM workflow.task t
          WHERE t.client_matter_id = m.client_matter_id AND t.task_type = 'provider_call'::text AND (t.status = ANY (ARRAY['open'::text, 'in_progress'::text])) AND t.due_date < CURRENT_DATE)) AS flag_provider_check_overdue,
    (EXISTS ( SELECT 1
           FROM medical.treatment_episode te
          WHERE te.client_matter_id = m.client_matter_id AND (te.status = ANY (ARRAY['gap_concern'::text, 'noncompliant'::text])))) AS flag_treatment_compliance,
    current_stage = 'records'::text AND (EXISTS ( SELECT 1
           FROM medical.treatment_episode te
          WHERE te.client_matter_id = m.client_matter_id AND te.status = 'completed'::text AND NOT (EXISTS ( SELECT 1
                   FROM medical.record_request rr
                  WHERE rr.treatment_episode_id = te.treatment_episode_id AND rr.status <> 'cancelled'::text)))) AS flag_records_not_ordered,
    (EXISTS ( SELECT 1
           FROM property.pd_claim pd
             JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
          WHERE v.incident_group_id = m.incident_group_id AND (pd.status <> ALL (ARRAY['resolved'::text, 'n_a'::text])) AND (m.current_stage = ANY (ARRAY['demand'::text, 'negotiation'::text])))) AS flag_pd_unresolved,
    (EXISTS ( SELECT 1
           FROM resolution.demand d
          WHERE d.client_matter_id = m.client_matter_id AND d.sent_date IS NOT NULL AND d.response_received IS NULL AND d.response_due < CURRENT_DATE)) AS flag_demand_response_overdue,
    (EXISTS ( SELECT 1
           FROM workflow.public_records_request prr
          WHERE (prr.client_matter_id = m.client_matter_id OR prr.incident_group_id = m.incident_group_id) AND prr.statute = 'tx_dps_driver_record'::text AND (prr.status <> ALL (ARRAY['fulfilled'::text, 'denied'::text, 'withdrawn'::text])))) AS flag_dps_record_outstanding,
    (EXISTS ( SELECT 1
           FROM workflow.public_records_request prr
          WHERE (prr.client_matter_id = m.client_matter_id OR prr.incident_group_id = m.incident_group_id) AND prr.statute <> 'tx_dps_driver_record'::text AND (prr.status <> ALL (ARRAY['fulfilled'::text, 'denied'::text, 'withdrawn'::text])))) AS flag_public_records_outstanding,
    (EXISTS ( SELECT 1
           FROM resolution.settlement st
          WHERE st.client_matter_id = m.client_matter_id AND st.agreed_date < (CURRENT_DATE - 60) AND NOT (EXISTS ( SELECT 1
                   FROM finance.disbursement_statement ds
                  WHERE ds.client_matter_id = m.client_matter_id AND ds.status = 'complete'::text)))) AS flag_disbursement_aging,
    sol_date IS NOT NULL AND sol_date < (CURRENT_DATE + 120) AND current_stage <> 'closed'::text AS flag_sol_within_120d
   FROM core.client_matter m
  WHERE deleted_at IS NULL AND representation_status = 'active'::text AND current_stage <> 'closed'::text;
GRANT INSERT ON workflow.v_stalled_cases TO app_staff;
GRANT SELECT ON workflow.v_stalled_cases TO app_staff;
GRANT UPDATE ON workflow.v_stalled_cases TO app_staff;

COMMIT;
