-- ================================================================================
-- TUTTLE OS — v2.4: § 18.001 AFFIDAVIT DEADLINE ENGINE
-- Michael's rule (2026-07-13):
--   "The 18.001 affidavits have an automatic clock tied to when a defendant files
--    an answer. If a second (third, fourth…) defendant answers, the 18.001 clock
--    for each corresponding defendant is calculated. If a DCO provides an 18.001
--    clock by ORDER of the Court, that ONE date supersedes any deadlines that were
--    calculated off the various defendants' answers."
--
-- What this adds:
--   A. ref.deadline_rule rows for the two statutory clocks (serve 90d / counter 120d)
--   B. litigation.scheduling_order gains affidavit_18001_deadline and
--      counter_affidavit_deadline (a court-ordered 18.001 date now has a structural home)
--   C. Trigger on litigation.lit_party: setting answer_filed on a defendant-side
--      party dockets THAT defendant's two clocks into workflow.deadline.
--      N defendants answering on N dates → N independent clock pairs.
--      If a court-ordered 18.001 date already controls the case, no statutory
--      serve clock starts for a late-answering defendant (the order controls).
--   D. apply_scheduling_order(): when the order SETS an 18.001 date, every pending
--      statutory serve clock on the case is vacated and the single court-ordered
--      date is docketed. Counter clocks are vacated only if the order sets a
--      counter deadline; an order silent on counters leaves them running.
--      Orders silent on 18.001 entirely leave all statutory clocks untouched.
--
-- All computed dates are ATTORNEY-VERIFY (HB 4595 / 18.001 anchor already flagged).
-- Rollback: rollback_v2.4_18001_engine.sql (removes trigger/columns, restores the
-- prior apply_scheduling_order verbatim; deadline ROWS already docketed are data
-- and are intentionally left in place).
-- ================================================================================

BEGIN;

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

-- ------------------------------------------------------------------
-- A. statutory rules
-- ------------------------------------------------------------------
INSERT INTO ref.deadline_rule (code, label, authority, day_count, count_unit, count_method, roll_rule, service_mail_extension, jurisdictional, applies_to, notes) VALUES
 ('affidavit_18001_serve_90',
  'Serve § 18.001 affidavits (per answering defendant)',
  'CPRC § 18.001(d)', 90, 'day', 'calendar', 'none', false, false, 'litigation',
  'EARLIER of 90 days after THAT defendant''s answer or the expert-designation deadline of the party seeking affirmative relief. One clock per answering defendant. A court-ordered 18.001 date (DCO) supersedes ALL per-answer clocks case-wide. Evidence-critical, not jurisdictional. ATTORNEY-VERIFY (HB 4595 anchor).'),
 ('affidavit_18001_counter_120',
  'Counter-affidavit window (defense deadline — watch)',
  'CPRC § 18.001(e)', 120, 'day', 'calendar', 'none', false, false, 'litigation',
  'Defense counter-affidavit deadline per answering defendant — their silence locks in our affidavits. Superseded only when a court order sets a counter deadline. ATTORNEY-VERIFY.')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------
-- B. structural home for court-ordered 18.001 dates
-- ------------------------------------------------------------------
ALTER TABLE litigation.scheduling_order
  ADD COLUMN IF NOT EXISTS affidavit_18001_deadline date,
  ADD COLUMN IF NOT EXISTS counter_affidavit_deadline date;

COMMENT ON COLUMN litigation.scheduling_order.affidavit_18001_deadline IS
  'v2.4: 18.001 affidavit service date SET BY THE ORDER (often same day as P expert designation, not always). When present, apply_scheduling_order vacates every per-answer statutory serve clock and dockets this single date. NULL = order silent, statutory clocks stand.';
COMMENT ON COLUMN litigation.scheduling_order.counter_affidavit_deadline IS
  'v2.4: counter-affidavit date set by the order, if any. When present, per-answer counter watches are vacated in favor of it. NULL = order silent, statutory counter clocks stand.';

-- ------------------------------------------------------------------
-- C. per-defendant clocks on answer
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION litigation.on_answer_filed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION litigation.on_answer_filed() FROM PUBLIC;

-- NAME MATTERS: same-event triggers fire alphabetically, and this one must run
-- AFTER trg_lit_party_register (which creates the core.entity row our deadline
-- rows reference) when a party is inserted with its answer already filled in.
-- 'x18001' sorts after 'register'. Do not rename it earlier in the alphabet.
DROP TRIGGER IF EXISTS trg_lit_party_answer_18001 ON litigation.lit_party;
DROP TRIGGER IF EXISTS trg_lit_party_x18001_answer ON litigation.lit_party;
CREATE TRIGGER trg_lit_party_x18001_answer
  AFTER INSERT OR UPDATE OF answer_filed ON litigation.lit_party
  FOR EACH ROW EXECUTE FUNCTION litigation.on_answer_filed();

-- ------------------------------------------------------------------
-- D. court-order supersession in apply_scheduling_order
-- ------------------------------------------------------------------
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

COMMIT;
