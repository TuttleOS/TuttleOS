-- ============================================================================
-- TUTTLE LAW FIRM — PRACTICE MANAGEMENT DATABASE
-- v2.1 UPGRADE SCRIPT  |  2026-07-12  |  applies on top of v2.0
--
-- CHANGELOG v2.0 -> v2.1
--   A. Data-loss protection (MF-01): every ON DELETE CASCADE on business data
--      converted to RESTRICT; deleted_at added to all business tables lacking
--      it (soft delete is the only retirement path — Michael 2026-07-12);
--      audit coverage widened from 6 tables to all legally consequential ones.
--   B. Audit integrity (MF-04): audit actor now mandatory (loud failure);
--      audit/registry/touch trigger functions SECURITY DEFINER, locked path.
--   C. SOL engine (MF-02/MF-09 scaffold): core.compute_pi_sol() + trigger
--      populates limitations_analysis.computed_sol_date; reconciliation view
--      core.v_sol_reconciliation. ATTORNEY-VERIFY tags on every legal branch.
--   D. Access control (MF-03/MF-11): auth bridge on core.staff, app.* helper
--      functions, RLS on all business tables per firm decisions:
--        - all active staff see all matters
--        - finance detail: attorney + lien_disbursement only
--        - discovery content: attorney + litigation_paralegal only
--        - conflicts (representation_link): attorney + can_clear_conflicts
--        - NO DELETE policy anywhere (soft delete only)
--      All views flipped to security_invoker; PUBLIC execute revoked.
--   E. Performance (MF-13/MF-14): indexes on all unindexed single-column FKs;
--      touch_updated_at attached to every table carrying updated_at.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ----------------------------------------------------------------------------
-- A1. Convert every ON DELETE CASCADE in business schemas to RESTRICT
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record; def text; n int := 0;
BEGIN
  FOR r IN
    SELECT c.oid, c.conname, c.conrelid::regclass AS tbl,
           pg_get_constraintdef(c.oid) AS condef
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c'
      AND ns.nspname IN ('core','workflow','insurance','medical','property',
                         'liens','resolution','litigation','finance','ref','analytics')
  LOOP
    def := replace(r.condef, 'ON DELETE CASCADE', 'ON DELETE RESTRICT');
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.conname, def);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'A1: % cascade FKs converted to RESTRICT', n;
END $$;

-- ----------------------------------------------------------------------------
-- A2. deleted_at on every business table that lacks it
--     (excluded: append-only ledgers/history and the entity registry)
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT ns.nspname, cl.relname
    FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE cl.relkind = 'r'
      AND ns.nspname IN ('core','workflow','insurance','medical','property',
                         'liens','resolution','litigation','finance')
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = cl.oid AND a.attname = 'deleted_at' AND NOT a.attisdropped)
      AND (ns.nspname, cl.relname) NOT IN
          (('core','entity'), ('core','stage_history'),
           ('finance','trust_transaction'), ('liens','lien_event'))
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD COLUMN deleted_at timestamptz', r.nspname, r.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'A2: deleted_at added to % tables', n;
END $$;

-- ----------------------------------------------------------------------------
-- A3. Widen audit coverage to legally consequential tables (uuid-PK, convention <table>_id)
-- ----------------------------------------------------------------------------
DO $$
DECLARE t text; pk text; n int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'core.limitations_analysis','core.incident_group','core.person',
    'workflow.deadline','workflow.document','workflow.task',
    'litigation.court_case','litigation.scheduling_order',
    'finance.fee_agreement','finance.fee_split','finance.case_expense',
    'finance.disbursement_line','medical.bill','resolution.demand',
    'resolution.release','insurance.coverage_assessment','insurance.claim']
  LOOP
    IF to_regclass(t) IS NOT NULL THEN
      pk := split_part(t,'.',2) || '_id';
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %s
         FOR EACH ROW EXECUTE FUNCTION audit.log_change(%L)',
        replace(split_part(t,'.',2),'.','_'), t, pk);
      n := n + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'A3: audit trigger attached to % additional tables', n;
END $$;

-- ----------------------------------------------------------------------------
-- B1. Audit actor becomes mandatory; loud failure when unset
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.log_change() RETURNS trigger AS $$
DECLARE v_pk uuid; v_actor uuid;
BEGIN
  v_actor := nullif(current_setting('app.staff_id', true), '')::uuid;
  IF v_actor IS NULL THEN
    -- fall back to the auth bridge (Supabase auto-API path)
    v_actor := app.current_staff_id();
  END IF;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'audit.log_change: no actor (app.staff_id unset and no auth bridge match) for % on %.%',
      TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING HINT = 'Set app.staff_id or connect through an authenticated staff account.';
  END IF;
  v_pk := (to_jsonb(coalesce(NEW, OLD)) ->> TG_ARGV[0])::uuid;
  INSERT INTO audit.change_log
    (schema_name, table_name, row_pk, op, old_row, new_row, changed_by)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk, TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          v_actor);
  RETURN coalesce(NEW, OLD);
END $$ LANGUAGE plpgsql;

ALTER TABLE audit.change_log ALTER COLUMN changed_by SET NOT NULL;

-- ----------------------------------------------------------------------------
-- C. Auth bridge + app helpers (created BEFORE B2 locks definer functions,
--    because audit.log_change now calls app.current_staff_id)
-- ----------------------------------------------------------------------------
ALTER TABLE core.staff ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;

CREATE SCHEMA IF NOT EXISTS app;

-- Returns Supabase auth.uid() when running under the auto-API, else NULL.
CREATE OR REPLACE FUNCTION app.auth_uid() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE v uuid;
BEGIN
  IF to_regproc('auth.uid') IS NOT NULL THEN
    EXECUTE 'SELECT auth.uid()' INTO v;
    RETURN v;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app.current_staff_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    nullif(current_setting('app.staff_id', true), '')::uuid,
    (SELECT s.staff_id FROM core.staff s
      WHERE s.auth_user_id = app.auth_uid() AND s.active AND s.separated_date IS NULL
      LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION app.current_staff() RETURNS core.staff
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.* FROM core.staff s WHERE s.staff_id = app.current_staff_id();
$$;

CREATE OR REPLACE FUNCTION app.is_active_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM core.staff s
                 WHERE s.staff_id = app.current_staff_id() AND s.active);
$$;

CREATE OR REPLACE FUNCTION app.has_role(VARIADIC roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM core.staff s
                 WHERE s.staff_id = app.current_staff_id() AND s.active
                   AND (s.role_code = ANY(roles) OR s.is_attorney));
$$;  -- NOTE: attorneys implicitly pass every role check

CREATE OR REPLACE FUNCTION app.is_intake_only() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM core.staff s
                 WHERE s.staff_id = app.current_staff_id() AND s.active
                   AND s.role_code = 'intake' AND NOT s.is_attorney);
$$;

CREATE OR REPLACE FUNCTION app.is_attorney() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM core.staff s
                 WHERE s.staff_id = app.current_staff_id() AND s.active AND s.is_attorney);
$$;

CREATE OR REPLACE FUNCTION app.can_clear_conflicts() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM core.staff s
                 WHERE s.staff_id = app.current_staff_id() AND s.active
                   AND (s.can_clear_conflicts OR s.is_attorney));
$$;

-- ----------------------------------------------------------------------------
-- B2. Lock down the definer trigger functions
-- ----------------------------------------------------------------------------
ALTER FUNCTION audit.log_change()      SECURITY DEFINER SET search_path = '';
ALTER FUNCTION core.register_entity()  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION core.unregister_entity() SECURITY DEFINER SET search_path = '';
ALTER FUNCTION core.touch_updated_at() SECURITY DEFINER SET search_path = '';
DO $$ BEGIN
  IF to_regproc('audit.block_mutation') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION audit.block_mutation() SECURITY DEFINER SET search_path = ''''';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- D. SOL engine (MF-02). EVERY LEGAL BRANCH REQUIRES ATTORNEY VERIFICATION.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.compute_pi_sol(
  p_base_accrual date,
  p_client_dob date DEFAULT NULL,
  p_tolling_minor boolean DEFAULT false,
  p_wrongful_death boolean DEFAULT false,
  p_date_of_death date DEFAULT NULL
) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v date;
BEGIN
  IF p_base_accrual IS NULL THEN RETURN NULL; END IF;

  -- Standard Texas PI limitations: 2 years from accrual.
  -- ATTORNEY-VERIFY: CPRC 16.003(a).
  v := p_base_accrual + interval '2 years';

  -- Wrongful death: 2 years from date of death, not date of injury.
  -- ATTORNEY-VERIFY: CPRC 16.003(b); interaction with survival claims (MF-09).
  IF p_wrongful_death AND p_date_of_death IS NOT NULL THEN
    v := greatest(v, p_date_of_death + interval '2 years');
  END IF;

  -- Minor tolling: limitations tolled during minority; runs 2 years from
  -- 18th birthday for the child's own claim.
  -- ATTORNEY-VERIFY: CPRC 16.001(a)(1),(b); does NOT extend parents' derivative
  -- claims (medical expenses) — those stay on the standard period (MF-09).
  IF p_tolling_minor AND p_client_dob IS NOT NULL
     AND p_client_dob + interval '18 years' > p_base_accrual THEN
    v := greatest(v, p_client_dob + interval '18 years' + interval '2 years');
  END IF;

  RETURN v::date;
END $$;

-- Trigger: keep computed_sol_date current on limitations_analysis
CREATE OR REPLACE FUNCTION core.trg_compute_sol() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_dob date; v_dod date;
BEGIN
  SELECT p.date_of_birth, p.date_of_death INTO v_dob, v_dod
  FROM core.client_matter cm
  JOIN core.person p ON p.person_id = cm.client_person_id
  WHERE cm.client_matter_id = NEW.client_matter_id;

  NEW.computed_sol_date := core.compute_pi_sol(
    NEW.base_accrual_date, v_dob, NEW.tolling_minor,
    NEW.wrongful_death_survival, v_dod);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_limitations_compute_sol ON core.limitations_analysis;
CREATE TRIGGER trg_limitations_compute_sol
  BEFORE INSERT OR UPDATE OF base_accrual_date, tolling_minor, wrongful_death_survival
  ON core.limitations_analysis
  FOR EACH ROW EXECUTE FUNCTION core.trg_compute_sol();

-- Reconciliation: human value vs engine value. NEVER auto-overwrites sol_date.
CREATE OR REPLACE VIEW core.v_sol_reconciliation AS
SELECT cm.client_matter_id,
       cm.casepeer_case_id,
       p.last_name || ', ' || p.first_name AS client,
       cm.current_stage,
       cm.sol_date            AS stored_sol,
       la.computed_sol_date   AS computed_sol,
       cm.sol_date - la.computed_sol_date AS delta_days,
       CASE
         WHEN la.computed_sol_date IS NULL THEN 'no_computation'
         WHEN cm.sol_date IS NULL          THEN 'no_stored_value'
         WHEN cm.sol_date = la.computed_sol_date THEN 'match'
         -- Stored later than computed = staff may be relying on tolling the
         -- engine doesn't know about (minor, WD) — or may think they have
         -- more time than the law gives. RISK until each is explained.
         WHEN cm.sol_date >  la.computed_sol_date THEN 'STORED_LATER_REVIEW_tolling_or_error'
         -- Stored earlier than computed = conservative; verify but low risk.
         ELSE 'stored_earlier_conservative'
       END AS reconciliation,
       cm.sol_status
FROM core.client_matter cm
JOIN core.person p ON p.person_id = cm.client_person_id
LEFT JOIN core.limitations_analysis la USING (client_matter_id)
WHERE cm.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- E. Row-Level Security
-- ----------------------------------------------------------------------------
-- E1. Application role (Supabase: apply same grants to 'authenticated')
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_staff') THEN
    CREATE ROLE app_staff NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA core, workflow, insurance, medical, property, liens,
                     resolution, litigation, finance, ref, analytics, audit, app
TO app_staff;

-- E2. Enable RLS everywhere in business schemas (+ ref, + audit log)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ns.nspname, cl.relname
    FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE cl.relkind = 'r'
      AND ns.nspname IN ('core','workflow','insurance','medical','property',
                         'liens','resolution','litigation','finance','ref','audit')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.nspname, r.relname);
  END LOOP;
END $$;

-- E3. Policies.
--   Tier F (finance detail)  : attorney or lien_disbursement
--   Tier W (work product)    : attorney or litigation_paralegal
--   Tier C (conflict links)  : attorney or can_clear_conflicts
--   Tier R (ref data)        : read all staff, write attorney
--   Tier A (audit log)       : read attorney, write nobody (definer only)
--   Tier G (everything else) : all active staff read/write
--   NO table gets a DELETE policy: deletes are denied for app roles everywhere.
DO $$
DECLARE r record; pred text;
BEGIN
  FOR r IN
    SELECT ns.nspname AS s, cl.relname AS t
    FROM pg_class cl JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE cl.relkind = 'r'
      AND ns.nspname IN ('core','workflow','insurance','medical','property',
                         'liens','resolution','litigation','finance','ref','audit')
  LOOP
    IF r.s = 'audit' THEN
      EXECUTE format('CREATE POLICY p_read ON %I.%I FOR SELECT USING (app.is_attorney())', r.s, r.t);
      CONTINUE;  -- no write policies: only the SECURITY DEFINER logger writes
    ELSIF r.s = 'ref' THEN
      EXECUTE format('CREATE POLICY p_read ON %I.%I FOR SELECT USING (app.is_active_staff())', r.s, r.t);
      EXECUTE format('CREATE POLICY p_ins ON %I.%I FOR INSERT WITH CHECK (app.is_attorney())', r.s, r.t);
      EXECUTE format('CREATE POLICY p_upd ON %I.%I FOR UPDATE USING (app.is_attorney()) WITH CHECK (app.is_attorney())', r.s, r.t);
      CONTINUE;
    ELSIF r.s = 'finance' OR (r.s = 'resolution' AND r.t LIKE 'settlement%') THEN
      pred := 'app.has_role(''lien_disbursement'')';
    ELSIF r.s = 'litigation' AND r.t = 'discovery_request' THEN
      pred := 'app.has_role(''litigation_paralegal'')';
    ELSIF r.s = 'core' AND r.t = 'representation_link' THEN
      pred := 'app.can_clear_conflicts()';
    ELSIF r.s IN ('medical','litigation','resolution','liens','insurance','property') THEN
      -- Intake enforcement (Michael 2026-07-13): intake role works leads,
      -- persons, contacts, and sign-up; substantive case data is a real wall.
      pred := '(app.is_active_staff() AND NOT app.is_intake_only())';
    ELSE
      pred := 'app.is_active_staff()';
    END IF;
    EXECUTE format('CREATE POLICY p_read ON %I.%I FOR SELECT USING (%s)', r.s, r.t, pred);
    EXECUTE format('CREATE POLICY p_ins  ON %I.%I FOR INSERT WITH CHECK (%s)', r.s, r.t, pred);
    EXECUTE format('CREATE POLICY p_upd  ON %I.%I FOR UPDATE USING (%s) WITH CHECK (%s)', r.s, r.t, pred, pred);
  END LOOP;
  RAISE NOTICE 'E3: policies created';
END $$;

-- E4. Table privileges: read/write but NEVER delete (belt + suspenders with E3)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA
  core, workflow, insurance, medical, property, liens, resolution,
  litigation, finance, ref TO app_staff;
GRANT SELECT ON ALL TABLES IN SCHEMA audit, analytics TO app_staff;

-- E5. Views run as the querying user (RLS applies through them)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, viewname FROM pg_views
           WHERE schemaname IN ('core','workflow','insurance','medical','property',
                                'liens','resolution','litigation','finance','analytics')
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = on)', r.schemaname, r.viewname);
  END LOOP;
END $$;

-- E6. Function surface: nothing executable by default; grant back deliberately
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['core','workflow','audit','analytics','app',
                           'insurance','medical','property','liens','resolution',
                           'litigation','finance','ref']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', s);
    END IF;
  END LOOP;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_staff;
GRANT EXECUTE ON FUNCTION core.compute_pi_sol(date,date,boolean,boolean,date) TO app_staff;

-- ----------------------------------------------------------------------------
-- F. Performance: touch triggers + FK indexes
-- ----------------------------------------------------------------------------
-- F1. touch_updated_at on every table with updated_at but no touch trigger
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT ns.nspname, cl.relname
    FROM pg_class cl
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attname = 'updated_at' AND NOT a.attisdropped
    WHERE cl.relkind = 'r'
      AND ns.nspname IN ('core','workflow','insurance','medical','property',
                         'liens','resolution','litigation','finance','ref')
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger tg
        WHERE tg.tgrelid = cl.oid AND NOT tg.tgisinternal
          AND tg.tgfoid = 'core.touch_updated_at'::regproc)
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %I.%I
                    FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at()',
                   r.relname, r.nspname, r.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'F1: touch trigger attached to % tables', n;
END $$;

-- F2. Index every unindexed single-column FK in business schemas
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT ns.nspname AS s, cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey,1) = 1
      AND ns.nspname IN ('core','workflow','insurance','medical','property',
                         'liens','resolution','litigation','finance')
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = cl.oid AND i.indkey[0] = c.conkey[1])
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_%s ON %I.%I (%I)',
                   r.t, r.col, r.s, r.t, r.col);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'F2: % FK indexes created', n;
END $$;

-- ----------------------------------------------------------------------------
-- G. Sign-up checklist restructure (Michael 2026-07-13) + MF-10 idempotency fix
--    DINSCO: claim opened, then LOR sent. PINSCO: separate items; if the client
--    refuses a first-party claim, that refusal is DOCUMENTED, never skipped
--    (insurance.coverage_assessment.pinsco_permission_to_use / _note is the
--    structured home for the refusal; the task title points staff there).
--    Also adds the IF-NOT-EXISTS guard so a bilingual (EN+ES) double execution
--    can never duplicate the checklist.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.on_contract_executed() RETURNS trigger AS $$
DECLARE v_matter uuid; v_signed date; v_cm uuid;
BEGIN
  IF NEW.doc_type_code = 'contract' AND NEW.status = 'executed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'executed')
     AND NEW.client_matter_id IS NOT NULL
  THEN
    v_matter := NEW.client_matter_id;
    v_signed := coalesce(NEW.executed_date, CURRENT_DATE);
    UPDATE core.client_matter
       SET contract_signed_date = coalesce(contract_signed_date, v_signed),
           sign_up_date = coalesce(sign_up_date, v_signed)
     WHERE client_matter_id = v_matter;
    IF NOT EXISTS (SELECT 1 FROM workflow.viability_review vr
                    WHERE vr.client_matter_id = v_matter) THEN
      INSERT INTO workflow.viability_review (client_matter_id, due_date)
      VALUES (v_matter, v_signed + 7);
    END IF;
    -- MF-10 guard: the EN and ES contracts share doc_type 'contract'; executing
    -- both must not double the checklist.
    IF NOT EXISTS (SELECT 1 FROM workflow.task t
                    WHERE t.client_matter_id = v_matter
                      AND t.trigger_source = 'contract_signed') THEN
      SELECT sa.staff_id INTO v_cm FROM core.staff_assignment sa
       WHERE sa.client_matter_id = v_matter
         AND sa.assignment_role = 'case_manager' AND sa.ended_at IS NULL
       LIMIT 1;
      INSERT INTO workflow.task
        (entity_id, client_matter_id, task_type, title, owner_staff_id,
         due_date, priority, trigger_source)
      VALUES
        (v_matter, v_matter, 'signup_checklist',
         'Obtain HIPAA / medical authorizations', v_cm, v_signed + 3, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Open DINSCO (3rd-party) claim', v_cm, v_signed + 3, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Send DINSCO LOR (after claim opened)', v_cm, v_signed + 5, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Open PINSCO (1st-party) claim — or document client refusal in coverage assessment', v_cm, v_signed + 3, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Send PINSCO LOR (skip only if refusal documented)', v_cm, v_signed + 5, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Obtain PINSCO declarations page (skip only if claim refusal documented)', v_cm, v_signed + 5, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Obtain police / crash report — portal retrieval, retry until in file', v_cm, v_signed + 3, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Complete Case Profile for 7-day review', v_cm, v_signed + 5, 'high', 'contract_signed'),
        (v_matter, v_matter, 'signup_checklist',
         'Confirm SOL calculation / limitations analysis', v_cm, v_signed + 5, 'critical', 'contract_signed');
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- H. Task completion provenance (Michael 2026-07-13):
--    Document-backed tasks complete THEMSELVES when the document is logged
--    (completion_method='system'). A human may still complete them manually,
--    but only as an explicit OVERRIDE with a required reason — and overrides
--    are reportable so Michael can spot patterns worth looking into.
-- ----------------------------------------------------------------------------
ALTER TABLE workflow.task
  ADD COLUMN IF NOT EXISTS completion_method text
    CHECK (completion_method IN ('system','manual','manual_override')),
  ADD COLUMN IF NOT EXISTS override_reason text;
DO $$ BEGIN
  ALTER TABLE workflow.task ADD CONSTRAINT task_override_needs_reason CHECK
    (completion_method IS DISTINCT FROM 'manual_override' OR override_reason IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-complete: logging the document IS completing the task.
-- (v1 maps by doc type + title keyword; the real LOR→claim link can refine
--  DINSCO vs PINSCO matching once documents attach to specific claims.)
CREATE OR REPLACE FUNCTION workflow.auto_complete_doc_tasks() RETURNS trigger AS $$
DECLARE v_pattern text;
BEGIN
  v_pattern := CASE NEW.doc_type_code
    WHEN 'police_report' THEN 'Obtain police / crash report%'
    WHEN 'dec_sheet'     THEN 'Obtain PINSCO declarations page%'
    WHEN 'hipaa_auth'    THEN 'Obtain HIPAA / medical authorizations%'
    WHEN 'lor' THEN CASE
        WHEN NEW.title ILIKE '%pinsco%' OR NEW.title ILIKE '%first%part%' OR NEW.title ILIKE '%um/uim%'
          THEN 'Send PINSCO LOR%'
        WHEN NEW.title ILIKE '%dinsco%' OR NEW.title ILIKE '%liab%'
          THEN 'Send DINSCO LOR%'
        ELSE NULL END
    ELSE NULL END;
  IF v_pattern IS NOT NULL AND NEW.client_matter_id IS NOT NULL THEN
    UPDATE workflow.task
       SET status = 'done', completed_at = now(),
           completed_by = app.current_staff_id(),
           completion_method = 'system'
     WHERE client_matter_id = NEW.client_matter_id
       AND status IN ('open','in_progress')
       AND trigger_source = 'contract_signed'
       AND title ILIKE v_pattern;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doc_autocomplete ON workflow.document;
CREATE TRIGGER trg_doc_autocomplete AFTER INSERT OR UPDATE OF status ON workflow.document
  FOR EACH ROW EXECUTE FUNCTION workflow.auto_complete_doc_tasks();

-- Michael's override-pattern report: who overrides what, how often, and why.
CREATE OR REPLACE VIEW workflow.v_task_override_patterns AS
SELECT pe.first_name || ' ' || pe.last_name AS staff,
       t.title,
       count(*)                             AS overrides_90d,
       max(t.completed_at)                  AS most_recent,
       (array_agg(t.override_reason ORDER BY t.completed_at DESC))[1:3] AS recent_reasons
FROM workflow.task t
JOIN core.staff s ON s.staff_id = t.completed_by
JOIN core.person pe ON pe.person_id = s.person_id
WHERE t.completion_method = 'manual_override'
  AND t.completed_at > now() - interval '90 days'
GROUP BY 1, 2
ORDER BY overrides_90d DESC, most_recent DESC;

-- ----------------------------------------------------------------------------
-- I. Multiple adjusters per claim (Michael 2026-07-13).
--    Carriers assign different people to different functions on ONE claim
--    (BI adjuster vs PD adjuster vs MedPay vs litigation adjuster), and they
--    rotate adjusters mid-claim. insurance.claim's single adjuster_* columns
--    can't hold that. New: insurance.claim_adjuster — a contact list per
--    claim with a function label and start/end history. The claim's legacy
--    adjuster_* columns remain as a convenience for the primary contact but
--    the adjuster LIST is authoritative.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insurance.claim_adjuster (
  claim_adjuster_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES insurance.claim(claim_id) ON DELETE RESTRICT,
  adjuster_role text NOT NULL DEFAULT 'bodily_injury' CHECK (adjuster_role IN
    ('bodily_injury','property_damage','medpay_pip','um_uim','litigation',
     'supervisor','subrogation','other')),
  person_id uuid REFERENCES core.person(person_id),
  display_name text NOT NULL,            -- "Brenda Yates" or "Claims Team 5"
  phone text, phone_extension text,
  email citext,
  fax text,
  is_current boolean NOT NULL DEFAULT true,
  started_at date DEFAULT CURRENT_DATE,
  ended_at date,                         -- set when the carrier rotates them off
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT adj_ended_means_not_current CHECK (ended_at IS NULL OR NOT is_current)
);
CREATE INDEX IF NOT EXISTS idx_claim_adjuster_claim_id
  ON insurance.claim_adjuster (claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_adjuster_current
  ON insurance.claim_adjuster (claim_id, adjuster_role) WHERE is_current;

-- Bring the new table under the same governance as the rest of the schema:
-- touch trigger, RLS (insurance tier: active staff, intake excluded), grants.
DROP TRIGGER IF EXISTS trg_claim_adjuster_touch ON insurance.claim_adjuster;
CREATE TRIGGER trg_claim_adjuster_touch BEFORE UPDATE ON insurance.claim_adjuster
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
ALTER TABLE insurance.claim_adjuster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_read ON insurance.claim_adjuster;
CREATE POLICY p_read ON insurance.claim_adjuster FOR SELECT
  USING (app.is_active_staff() AND NOT app.is_intake_only());
DROP POLICY IF EXISTS p_ins ON insurance.claim_adjuster;
CREATE POLICY p_ins ON insurance.claim_adjuster FOR INSERT
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());
DROP POLICY IF EXISTS p_upd ON insurance.claim_adjuster;
CREATE POLICY p_upd ON insurance.claim_adjuster FOR UPDATE
  USING (app.is_active_staff() AND NOT app.is_intake_only())
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());
GRANT SELECT, INSERT, UPDATE ON insurance.claim_adjuster TO app_staff;

-- Convenience view: current adjuster roster per claim, one row per function.
CREATE OR REPLACE VIEW insurance.v_claim_adjuster_roster AS
SELECT ca.claim_id, c.claim_number, c.claim_role,
       ca.adjuster_role, ca.display_name, ca.phone, ca.phone_extension,
       ca.email, ca.started_at
FROM insurance.claim_adjuster ca
JOIN insurance.claim c USING (claim_id)
WHERE ca.is_current AND ca.deleted_at IS NULL
ORDER BY c.claim_number, ca.adjuster_role;
ALTER VIEW insurance.v_claim_adjuster_roster SET (security_invoker = on);
GRANT SELECT ON insurance.v_claim_adjuster_roster TO app_staff;

-- ----------------------------------------------------------------------------
-- J. Adjuster intelligence (Michael 2026-07-13): timestamped, attributed notes
--    about how an adjuster works, aggregated ACROSS claims and cases so the
--    firm builds a negotiation history per adjuster. Notes attach to the
--    specific claim-assignment (context: which case the observation came from)
--    and aggregate by the adjuster's person record when set, else by
--    carrier + normalized name.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS insurance.adjuster_note (
  adjuster_note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_adjuster_id uuid NOT NULL
    REFERENCES insurance.claim_adjuster(claim_adjuster_id) ON DELETE RESTRICT,
  note text NOT NULL,
  author_staff_id uuid REFERENCES core.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_adjuster_note_ca ON insurance.adjuster_note (claim_adjuster_id);

DROP TRIGGER IF EXISTS trg_adjuster_note_touch ON insurance.adjuster_note;
CREATE TRIGGER trg_adjuster_note_touch BEFORE UPDATE ON insurance.adjuster_note
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
ALTER TABLE insurance.adjuster_note ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_read ON insurance.adjuster_note;
CREATE POLICY p_read ON insurance.adjuster_note FOR SELECT
  USING (app.is_active_staff() AND NOT app.is_intake_only());
DROP POLICY IF EXISTS p_ins ON insurance.adjuster_note;
CREATE POLICY p_ins ON insurance.adjuster_note FOR INSERT
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());
DROP POLICY IF EXISTS p_upd ON insurance.adjuster_note;
CREATE POLICY p_upd ON insurance.adjuster_note FOR UPDATE
  USING (app.is_active_staff() AND NOT app.is_intake_only())
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());
GRANT SELECT, INSERT, UPDATE ON insurance.adjuster_note TO app_staff;

-- Cross-case history: every note about "the same adjuster", newest first,
-- with the case it came from. Same-adjuster key: person_id when recorded,
-- else carrier + normalized display name.
CREATE OR REPLACE VIEW insurance.v_adjuster_history AS
SELECT
  coalesce(ca.person_id::text,
           coalesce(pol_org.name, 'unknown-carrier') || ':' ||
           lower(regexp_replace(ca.display_name, '\s+', ' ', 'g')))   AS adjuster_key,
  ca.display_name                       AS adjuster,
  coalesce(pol_org.name, '(carrier unknown)') AS carrier,
  ca.adjuster_role,
  n.note, n.created_at,
  pe.first_name || ' ' || pe.last_name  AS author,
  cm.casepeer_case_id,
  cl_p.last_name || ', ' || cl_p.first_name AS case_client
FROM insurance.adjuster_note n
JOIN insurance.claim_adjuster ca USING (claim_adjuster_id)
JOIN insurance.claim c ON c.claim_id = ca.claim_id
LEFT JOIN insurance.policy pol ON pol.policy_id = c.policy_id
LEFT JOIN core.organization pol_org ON pol_org.organization_id = pol.carrier_org_id
LEFT JOIN core.client_matter cm ON cm.client_matter_id = c.client_matter_id
LEFT JOIN core.person cl_p ON cl_p.person_id = cm.client_person_id
LEFT JOIN core.staff s ON s.staff_id = n.author_staff_id
LEFT JOIN core.person pe ON pe.person_id = s.person_id
WHERE n.deleted_at IS NULL
ORDER BY adjuster_key, n.created_at DESC;
ALTER VIEW insurance.v_adjuster_history SET (security_invoker = on);
GRANT SELECT ON insurance.v_adjuster_history TO app_staff;

-- ----------------------------------------------------------------------------
-- K. Mediation candidates + mediator/carrier intelligence (Michael 2026-07-13).
--    The mediation section commences at the mediation deadline (DCO) with the
--    list of AGREED mediators. Each candidate tracks proposal side, agreement,
--    the availability request (sent via the seeded email_mediator_availability
--    template), and the response. Selecting a candidate populates
--    litigation.mediation.mediator_person_id.
--    v_mediator_carrier_history answers: which mediators does each carrier
--    use, how often, and how do those mediations end.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS litigation.mediation_candidate (
  mediation_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mediation_id uuid NOT NULL
    REFERENCES litigation.mediation(mediation_id) ON DELETE RESTRICT,
  mediator_person_id uuid REFERENCES core.person(person_id),
  display_name text NOT NULL,
  proposed_by text NOT NULL DEFAULT 'joint'
    CHECK (proposed_by IN ('plaintiff','defense','joint')),
  agreed boolean NOT NULL DEFAULT false,
  availability_requested_at timestamptz,   -- stamped when the template email generates
  availability_response text,              -- dates offered
  response_received_at timestamptz,
  selected boolean NOT NULL DEFAULT false,
  declined boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_mediation_candidate_mediation
  ON litigation.mediation_candidate (mediation_id);

DROP TRIGGER IF EXISTS trg_mediation_candidate_touch ON litigation.mediation_candidate;
CREATE TRIGGER trg_mediation_candidate_touch BEFORE UPDATE ON litigation.mediation_candidate
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
ALTER TABLE litigation.mediation_candidate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_read ON litigation.mediation_candidate;
CREATE POLICY p_read ON litigation.mediation_candidate FOR SELECT
  USING (app.is_active_staff() AND NOT app.is_intake_only());
DROP POLICY IF EXISTS p_ins ON litigation.mediation_candidate;
CREATE POLICY p_ins ON litigation.mediation_candidate FOR INSERT
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());
DROP POLICY IF EXISTS p_upd ON litigation.mediation_candidate;
CREATE POLICY p_upd ON litigation.mediation_candidate FOR UPDATE
  USING (app.is_active_staff() AND NOT app.is_intake_only())
  WITH CHECK (app.is_active_staff() AND NOT app.is_intake_only());
GRANT SELECT, INSERT, UPDATE ON litigation.mediation_candidate TO app_staff;

-- Which mediators do which carriers use, and how do those mediations end?
CREATE OR REPLACE VIEW litigation.v_mediator_carrier_history AS
SELECT
  pe.first_name || ' ' || pe.last_name          AS mediator,
  org.name                                      AS carrier,
  count(DISTINCT m.mediation_id)                AS mediations,
  count(DISTINCT m.mediation_id) FILTER (WHERE m.result = 'settled')          AS settled,
  count(DISTINCT m.mediation_id) FILTER (WHERE m.result = 'settled_in_part')  AS settled_in_part,
  count(DISTINCT m.mediation_id) FILTER (WHERE m.result = 'impasse')          AS impasse,
  max(m.scheduled_at)::date                     AS last_used,
  round(avg(m.fee_amount), 2)                   AS avg_fee
FROM litigation.mediation m
JOIN core.person pe ON pe.person_id = m.mediator_person_id
JOIN core.client_matter cm ON cm.client_matter_id = coalesce(
      m.client_matter_id,
      (SELECT cc.client_matter_id FROM litigation.court_case cc
        WHERE cc.court_case_id = m.court_case_id))
JOIN insurance.claim ic ON ic.client_matter_id = cm.client_matter_id
                       AND ic.claim_role IN ('dinsco_liability','um_uim','umbrella')
JOIN insurance.policy pol ON pol.policy_id = ic.policy_id
JOIN core.organization org ON org.organization_id = pol.carrier_org_id
GROUP BY 1, 2
ORDER BY mediator, mediations DESC;
ALTER VIEW litigation.v_mediator_carrier_history SET (security_invoker = on);
GRANT SELECT ON litigation.v_mediator_carrier_history TO app_staff;

-- Which mediators are AGREEABLE to which defense firms/attorneys?
-- Sources both signals: (a) candidate-stage agreement (they said yes to this
-- mediator), keyed to the defense counsel on that case's lit_party rows; and
-- (b) completed mediations with that firm on the other side.
CREATE OR REPLACE VIEW litigation.v_mediator_defense_history AS
WITH med_case AS (
  SELECT m.mediation_id, m.result,
         coalesce(m.court_case_id,
           (SELECT cc.court_case_id FROM litigation.court_case cc
             WHERE cc.client_matter_id = m.client_matter_id LIMIT 1)) AS court_case_id
  FROM litigation.mediation m
)
SELECT
  mc_med.display_name                        AS mediator,
  co.name                                    AS defense_firm,
  cp.first_name || ' ' || cp.last_name       AS defense_attorney,
  count(*) FILTER (WHERE mc_med.agreed)      AS times_agreed,
  count(*) FILTER (WHERE mc_med.declined)    AS times_declined,
  count(*) FILTER (WHERE mc_med.selected)    AS times_selected,
  count(*) FILTER (WHERE med.result = 'settled') AS settled_with,
  max(mc_med.created_at)::date               AS last_seen
FROM litigation.mediation_candidate mc_med
JOIN med_case med ON med.mediation_id = mc_med.mediation_id
JOIN litigation.lit_party lp ON lp.court_case_id = med.court_case_id
  AND lp.alignment IN ('defendant','third_party_defendant')
  AND lp.counsel_org_id IS NOT NULL
JOIN core.organization co ON co.organization_id = lp.counsel_org_id
LEFT JOIN core.person cp ON cp.person_id = lp.counsel_person_id
WHERE mc_med.deleted_at IS NULL
GROUP BY 1, 2, 3
ORDER BY mediator, times_agreed DESC;
ALTER VIEW litigation.v_mediator_defense_history SET (security_invoker = on);
GRANT SELECT ON litigation.v_mediator_defense_history TO app_staff;

-- ----------------------------------------------------------------------------
-- L. Phone normalization: US default + Mexico (Michael 2026-07-13).
--    99% of client numbers are US or MX. US stays the default; a 12-digit
--    number starting with 52 (or anything entered with an explicit +) now
--    normalizes instead of falling to NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.normalize_phone_e164() RETURNS trigger AS $$
DECLARE digits text;
BEGIN
  IF NEW.kind IN ('phone','fax') AND NEW.phone IS NOT NULL THEN
    digits := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
    IF left(trim(NEW.phone), 1) = '+' THEN
      NEW.phone_e164 := '+' || digits;
    ELSIF length(digits) = 10 THEN
      NEW.phone_e164 := '+1' || digits;                    -- US default
    ELSIF length(digits) = 11 AND left(digits,1) = '1' THEN
      NEW.phone_e164 := '+' || digits;                     -- US w/ country code
    ELSIF length(digits) = 12 AND left(digits,2) = '52' THEN
      NEW.phone_e164 := '+' || digits;                     -- Mexico (+52, 10-digit national)
    ELSE
      NEW.phone_e164 := NULL;   -- unparseable: surfaces as a data-quality gap
    END IF;
  ELSIF NEW.kind IN ('phone','fax') THEN
    NEW.phone_e164 := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- M. LOR "actually sent" discipline (Michael 2026-07-13).
--    Generating an LOR is NOT sending it. The proof of completion for the
--    DINSCO/PINSCO LOR checklist tasks is insurance.claim.lor_sent — the date
--    the letter actually went out, entered by the user. Document generation
--    no longer completes LOR tasks (supersedes the 'lor' branch in section H).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflow.auto_complete_doc_tasks() RETURNS trigger AS $$
DECLARE v_pattern text;
BEGIN
  v_pattern := CASE NEW.doc_type_code
    WHEN 'police_report' THEN 'Obtain police / crash report%'
    WHEN 'dec_sheet'     THEN 'Obtain PINSCO declarations page%'
    WHEN 'hipaa_auth'    THEN 'Obtain HIPAA / medical authorizations%'
    -- 'lor' intentionally absent: generation ≠ sent (see trg_lor_sent below)
    ELSE NULL END;
  IF v_pattern IS NOT NULL AND NEW.client_matter_id IS NOT NULL THEN
    UPDATE workflow.task
       SET status = 'done', completed_at = now(),
           completed_by = app.current_staff_id(),
           completion_method = 'system'
     WHERE client_matter_id = NEW.client_matter_id
       AND status IN ('open','in_progress')
       AND trigger_source = 'contract_signed'
       AND title ILIKE v_pattern;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Recording the ACTUAL sent date on the claim is what completes the LOR task.
CREATE OR REPLACE FUNCTION insurance.on_lor_sent() RETURNS trigger AS $$
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
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lor_sent ON insurance.claim;
CREATE TRIGGER trg_lor_sent AFTER INSERT OR UPDATE OF lor_sent ON insurance.claim
  FOR EACH ROW EXECUTE FUNCTION insurance.on_lor_sent();

-- ----------------------------------------------------------------------------
-- N. Every case carries a Case Manager AND a paralegal (Michael 2026-07-13).
--    Per the workflow's "block rarely, flag often" principle this is a FLAG,
--    not a hard block: matters missing an active CM or paralegal assignment
--    surface on the owner dashboard until staffed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW core.v_matter_role_gaps AS
SELECT cm.client_matter_id, cm.casepeer_case_id,
       p.last_name || ', ' || p.first_name AS client,
       cm.current_stage,
       NOT EXISTS (SELECT 1 FROM core.staff_assignment sa
                   WHERE sa.client_matter_id = cm.client_matter_id
                     AND sa.assignment_role = 'case_manager' AND sa.ended_at IS NULL) AS missing_case_manager,
       NOT EXISTS (SELECT 1 FROM core.staff_assignment sa
                   WHERE sa.client_matter_id = cm.client_matter_id
                     AND sa.assignment_role IN ('paralegal','litigation_paralegal') AND sa.ended_at IS NULL) AS missing_paralegal
FROM core.client_matter cm
JOIN core.person p ON p.person_id = cm.client_person_id
WHERE cm.deleted_at IS NULL
  AND cm.representation_status = 'active'
  AND (NOT EXISTS (SELECT 1 FROM core.staff_assignment sa
                   WHERE sa.client_matter_id = cm.client_matter_id
                     AND sa.assignment_role = 'case_manager' AND sa.ended_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM core.staff_assignment sa
                   WHERE sa.client_matter_id = cm.client_matter_id
                     AND sa.assignment_role IN ('paralegal','litigation_paralegal') AND sa.ended_at IS NULL));
ALTER VIEW core.v_matter_role_gaps SET (security_invoker = on);
GRANT SELECT ON core.v_matter_role_gaps TO app_staff;

COMMIT;
