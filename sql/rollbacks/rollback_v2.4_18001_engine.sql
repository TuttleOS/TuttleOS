-- ================================================================================
-- TUTTLE OS — v2.4 ROLLBACK: removes the § 18.001 deadline engine
-- Restores prior behavior. Deadline ROWS already docketed by the engine are case
-- data and are intentionally NOT deleted (vacate or delete them manually if you
-- also want the data gone). The two ref.deadline_rule rows are left in place if
-- any deadline row references them; they are inert without the trigger.
-- ================================================================================
BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

DROP TRIGGER IF EXISTS trg_lit_party_answer_18001 ON litigation.lit_party;
DROP TRIGGER IF EXISTS trg_lit_party_x18001_answer ON litigation.lit_party;
DROP FUNCTION IF EXISTS litigation.on_answer_filed();

-- restore the pre-v2.4 apply_scheduling_order verbatim:
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

  -- 2) create court_order deadlines from every date the order sets
  FOR r IN SELECT * FROM (VALUES
      ('Pleadings amendment deadline (DCO)', so.pleadings_amendment_deadline),
      ('Plaintiff expert designation (DCO)', so.expert_designation_plaintiff),
      ('Defense expert designation (DCO)',   so.expert_designation_defense),
      ('Expert challenge deadline (DCO)',    so.expert_challenge_deadline),
      ('Discovery closes (DCO)',             so.discovery_close),
      ('Dispositive motion deadline (DCO)',  so.dispositive_motion_deadline),
      ('Mediation deadline (DCO)',           so.mediation_deadline),
      ('Pretrial disclosures due (DCO)',     so.pretrial_disclosures_due),
      ('Trial date (DCO)',                   so.trial_date)
    ) AS t(label, d) WHERE t.d IS NOT NULL
  LOOP
    INSERT INTO workflow.deadline
      (entity_id, client_matter_id, label, base_event, base_date,
       computed_date, effective_date, source, scheduling_order_id)
    VALUES
      (so.court_case_id, v_matter, r.label, 'scheduling order', so.signed_date,
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
END $function$
;

-- drop the v2.4 columns (any court-ordered 18.001 dates stored in them are lost)
ALTER TABLE litigation.scheduling_order
  DROP COLUMN IF EXISTS affidavit_18001_deadline,
  DROP COLUMN IF EXISTS counter_affidavit_deadline;

-- remove the rules only if nothing references them
DELETE FROM ref.deadline_rule r
 WHERE r.code IN ('affidavit_18001_serve_90','affidavit_18001_counter_120')
   AND NOT EXISTS (SELECT 1 FROM workflow.deadline d WHERE d.rule_code = r.code);

COMMIT;
