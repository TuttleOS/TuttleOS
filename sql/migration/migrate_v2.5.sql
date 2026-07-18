-- ============================================================
-- CasePeer -> Tuttle OS migration transform
-- Idempotent: deletes prior migrated rows first (matched by casepeer ids)
-- Prerequisites: staging.clients / open_cases / notes loaded (see load_staging.py)
-- Owner runbook: docs/CASEPEER_MIGRATION.md
-- Override expected open-case count:
--   psql -v expected_cases=770 -f sql/migration/migrate_v2.5.sql
-- ============================================================
\set ON_ERROR_STOP on
\if :{?expected_cases}
\else
\set expected_cases 770
\endif
BEGIN;

-- Migration actor: fixed UUID so audit rows written during the load are
-- attributed to a dedicated, identifiable actor (MF-04 resolution / gate 10.2).
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- ------------------------------------------------------------
-- 0a. Remove prior CasePeer-migrated rows (by casepeer_case_id)
-- ------------------------------------------------------------
CREATE TEMP TABLE _mig_prior ON COMMIT DROP AS
SELECT client_matter_id, incident_group_id, client_person_id, casepeer_case_id
FROM core.client_matter
WHERE casepeer_case_id IS NOT NULL
  AND deleted_at IS NULL;

DELETE FROM workflow.communication_log
WHERE client_matter_id IN (SELECT client_matter_id FROM _mig_prior);

DELETE FROM core.limitations_analysis
WHERE client_matter_id IN (SELECT client_matter_id FROM _mig_prior);

DELETE FROM core.staff_assignment
WHERE client_matter_id IN (SELECT client_matter_id FROM _mig_prior);

DELETE FROM workflow.note
WHERE entity_id IN (SELECT client_matter_id FROM _mig_prior);

UPDATE core.intake_lead il
SET resulting_matter_id = NULL
WHERE resulting_matter_id IN (SELECT client_matter_id FROM _mig_prior);

DELETE FROM core.intake_lead il
WHERE il.resulting_matter_id IS NULL
  AND il.status = 'signed'
  AND il.person_id IN (SELECT client_person_id FROM _mig_prior)
  AND NOT EXISTS (
    SELECT 1 FROM core.client_matter m
    WHERE m.client_person_id = il.person_id
      AND m.casepeer_case_id IS NULL
      AND m.deleted_at IS NULL
  );

DELETE FROM core.client_matter
WHERE client_matter_id IN (SELECT client_matter_id FROM _mig_prior);

DELETE FROM core.incident_group ig
WHERE ig.incident_group_id IN (SELECT DISTINCT incident_group_id FROM _mig_prior)
  AND NOT EXISTS (
    SELECT 1 FROM core.client_matter m
    WHERE m.incident_group_id = ig.incident_group_id
  );

-- Drop orphaned client persons from a prior migration pass (never staff).
DELETE FROM core.contact_point cp
WHERE cp.person_id IN (SELECT DISTINCT client_person_id FROM _mig_prior)
  AND NOT EXISTS (
    SELECT 1 FROM core.client_matter m WHERE m.client_person_id = cp.person_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM core.intake_lead il WHERE il.person_id = cp.person_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM core.staff s WHERE s.person_id = cp.person_id
  );

DELETE FROM core.person p
WHERE p.person_id IN (SELECT DISTINCT client_person_id FROM _mig_prior)
  AND NOT EXISTS (
    SELECT 1 FROM core.client_matter m WHERE m.client_person_id = p.person_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM core.intake_lead il WHERE il.person_id = p.person_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM core.staff s WHERE s.person_id = p.person_id
  );

-- ------------------------------------------------------------
-- 0b. Link table: pair client rows to open_case rows
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.case_link;
CREATE TABLE staging.case_link AS
WITH c AS (
  SELECT *, row_number() OVER (PARTITION BY "case", intake_date ORDER BY src_row) rn
  FROM staging.clients
), o AS (
  SELECT *, row_number() OVER (PARTITION BY "case", intake ORDER BY src_row) rn
  FROM staging.open_cases
)
SELECT o.case_id,
       c.lastname, c.firstname,
       nullif(trim(c.dob),'') AS dob_raw,
       nullif(trim(c.email),'') AS email,
       nullif(trim(c.phone),'') AS phone,
       nullif(trim(c.address),'') AS address,
       nullif(trim(c.city),'') AS client_city,
       nullif(trim(c.state),'') AS client_state,
       nullif(trim(c.zip),'') AS client_zip,
       nullif(trim(c.language),'') AS language,
       nullif(trim(c.race),'') AS race,
       nullif(trim(c.gender),'') AS gender,
       lower(coalesce(c.deceased,'false'))='true' AS deceased,
       nullif(trim(c.referral_source),'') AS c_referral_source,
       nullif(trim(c.source_detail),'') AS c_source_detail,
       o."case" AS case_name,
       nullif(trim(o.case_type),'') AS case_type,
       nullif(trim(o.case_status),'') AS case_status,
       nullif(trim(o.statute),'') AS statute,
       nullif(trim(o.doi),'') AS doi,
       nullif(trim(o.intake),'') AS intake,
       nullif(trim(o.retained),'') AS retained,
       nullif(trim(o.city),'') AS oc_city,
       nullif(trim(o.incident_address),'') AS incident_address,
       nullif(trim(o.incident_state),'') AS incident_state,
       nullif(trim(o.source_type),'') AS source_type,
       nullif(trim(o.source_detail),'') AS o_source_detail,
       nullif(trim(o.referred_by),'') AS referred_by,
       nullif(trim(o.client_comm),'') AS client_comm,
       nullif(trim(o.critical_case_note),'') AS critical_case_note,
       (o."case" ~ '\+ *\d+$') AS multi_client_flag
FROM o
JOIN c ON c."case" = o."case" AND c.intake_date = o.intake AND c.rn = o.rn;

-- sanity: expected unique case_id count (default 770 for the known Dropbox export)
DO $$
DECLARE n int; u int; expected int := :expected_cases;
BEGIN
  SELECT count(*), count(DISTINCT case_id) INTO n, u FROM staging.case_link;
  IF n <> expected OR u <> expected THEN
    RAISE EXCEPTION 'case_link expected % unique rows, got % rows / % unique (override: -v expected_cases=N)',
      expected, n, u;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Crosswalks
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.status_map;
CREATE TABLE staging.status_map (cp_status text PRIMARY KEY, stage text, flag text);
INSERT INTO staging.status_map VALUES
 ('Intake','intake',NULL),
 ('Pending Assignment','intake',NULL),
 ('Treating','treating',NULL),
 ('Litigation Treating','litigation',NULL),
 ('Pending Drop','treating','drop_review'),
 ('Drop Review','treating','drop_review'),
 ('Pending Demand','records',NULL),
 ('Demand Writing','demand',NULL),
 ('Demanded','demand',NULL),
 ('Pre Suit','demand','verify_stage'),
 ('Pending Response','negotiation',NULL),
 ('Settlement Negotiations','negotiation',NULL),
 ('UIM Demanded','negotiation',NULL),
 ('Pursuing UIM','negotiation',NULL),
 ('Pending Litigation','litigation',NULL),
 ('Service','litigation',NULL),
 ('Litigation Initiated','litigation',NULL),
 ('Litigation Discovery','litigation',NULL),
 ('Deposition','litigation',NULL),
 ('Mediation Prep','litigation',NULL),
 ('Mediation','litigation',NULL),
 ('Trial','litigation',NULL),
 ('Settled','settlement',NULL),
 ('Disbursement','settlement',NULL),
 ('Lien Negotiations','settlement',NULL),
 ('Disbursed','closed','disposition_review'),
 ('Referred Accepted Open','intake','attorney_review');

DROP TABLE IF EXISTS staging.case_type_map;
CREATE TABLE staging.case_type_map (cp_type text PRIMARY KEY, code text, flag text);
INSERT INTO staging.case_type_map VALUES
 ('Auto Accident','auto',NULL),
 ('Slip / Fall','premises',NULL),
 ('Premises Liability','premises',NULL),
 ('Commercial','trucking','verify_type'),
 ('Personal Injury','other','review_type'),
 ('Wrongful Termination','other','out_of_scope_employment'),
 ('Property Damage','other',NULL),
 ('Other','other',NULL);

-- ------------------------------------------------------------
-- 2. Staff (12 note authors + migration actor)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.staff_map;
CREATE TABLE staging.staff_map (cp_name text PRIMARY KEY, first_name text, last_name text,
  role_code text, is_attorney boolean DEFAULT false, can_approve boolean DEFAULT false,
  person_id uuid, staff_id uuid);
INSERT INTO staging.staff_map (cp_name, first_name, last_name, role_code, is_attorney, can_approve) VALUES
 -- Roles per Case_Workflow_v2.0 §2 (Michael=owner, Daniel=senior reviewer,
 -- Christina/Mark=CMs, Kate=demand writer, Emily=lien/disbursement).
 -- Remaining staff default to case_manager PENDING Michael's confirmation.
 ('Michael Tuttle','Michael','Tuttle','attorney',true,true),
 ('Daniel Becerra','Daniel','Becerra','senior_paralegal',false,true),
 ('Emily Shuler','Emily','Shuler','lien_disbursement',false,false),
 ('Valeria Rosario','Valeria','Rosario','case_manager',false,false),
 ('Intern Marco','Marco','(Intern)','admin',false,false),      -- ROLE PENDING
 ('Gabriel Medina','Gabriel','Medina','case_manager',false,false),
 ('Stephanie Zertuche','Stephanie','Zertuche','case_manager',false,false),
 ('Katelyn Tuttle','Katelyn','Tuttle','demand_writer',false,false),
 ('Mark Garza','Mark','Garza','case_manager',false,false),
 ('Carmen Rivera','Carmen','Rivera','case_manager',false,false),
 ('Patricia Baeza','Patricia','Baeza','case_manager',false,false),
 ('Christina Calderon','Christina','Calderon','case_manager',false,false),
 ('CasePeer Migration','CasePeer','Migration','admin',false,false);

-- Prefer existing staff already seeded / linked to Auth (match by person name).
UPDATE staging.staff_map m
SET person_id = s.person_id,
    staff_id = s.staff_id
FROM core.staff s
JOIN core.person p ON p.person_id = s.person_id
WHERE m.cp_name <> 'CasePeer Migration'
  AND lower(p.first_name) = lower(m.first_name)
  AND lower(p.last_name) = lower(m.last_name)
  AND s.active;

-- Migration actor = fixed UUID …c0de (same as battery System Actor / MF-04).
INSERT INTO core.person (person_id, first_name, last_name, preferred_language)
SELECT '00000000-0000-0000-0000-00000000c0d1', 'System', 'Actor', 'en'
WHERE NOT EXISTS (
  SELECT 1 FROM core.person WHERE person_id = '00000000-0000-0000-0000-00000000c0d1'
);

INSERT INTO core.staff (staff_id, person_id, role_code, is_attorney, can_approve_level,
                        can_clear_conflicts, active)
SELECT '00000000-0000-0000-0000-00000000c0de',
       '00000000-0000-0000-0000-00000000c0d1',
       'admin', false, false, false, false
WHERE NOT EXISTS (
  SELECT 1 FROM core.staff WHERE staff_id = '00000000-0000-0000-0000-00000000c0de'
);

UPDATE staging.staff_map
SET person_id = (SELECT person_id FROM core.staff
                 WHERE staff_id = '00000000-0000-0000-0000-00000000c0de'),
    staff_id = '00000000-0000-0000-0000-00000000c0de'
WHERE cp_name = 'CasePeer Migration';

-- New staff only (unmatched names) get fresh ids.
UPDATE staging.staff_map m
SET person_id = gen_random_uuid(),
    staff_id = gen_random_uuid()
WHERE m.person_id IS NULL
  AND m.cp_name <> 'CasePeer Migration';

INSERT INTO core.person (person_id, first_name, last_name, preferred_language)
SELECT m.person_id, m.first_name, m.last_name, 'en'
FROM staging.staff_map m
WHERE m.cp_name <> 'CasePeer Migration'
  AND NOT EXISTS (SELECT 1 FROM core.person p WHERE p.person_id = m.person_id);

INSERT INTO core.staff (staff_id, person_id, role_code, is_attorney, can_approve_level,
                        can_clear_conflicts, active)
SELECT m.staff_id, m.person_id, m.role_code, m.is_attorney, m.can_approve,
       m.can_approve,   -- workflow §2/§8: Level approvers also clear conflicts
       true
FROM staging.staff_map m
WHERE m.cp_name <> 'CasePeer Migration'
  AND NOT EXISTS (SELECT 1 FROM core.staff s WHERE s.staff_id = m.staff_id);

-- ------------------------------------------------------------
-- 3. Client persons (dedup by first+last+dob)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.person_key;
CREATE TABLE staging.person_key AS
SELECT DISTINCT ON (lower(firstname), lower(lastname), dob_raw)
       gen_random_uuid() AS person_id,
       firstname, lastname, dob_raw,
       language, race, gender, deceased
FROM staging.case_link
ORDER BY lower(firstname), lower(lastname), dob_raw, case_id;

INSERT INTO core.person (person_id, first_name, last_name, suffix, date_of_birth,
                         preferred_language, race_ethnicity, gender, is_deceased)
SELECT person_id,
       firstname,
       trim(regexp_replace(lastname, '\s+(Jr\.?|Sr\.?|II|III|IV)$', '')),
       nullif(trim((regexp_match(lastname, '\s+(Jr\.?|Sr\.?|II|III|IV)$'))[1]),''),
       to_date(dob_raw,'MM/DD/YYYY'),
       CASE language WHEN 'Spanish' THEN 'es' WHEN 'Arabic' THEN 'ar' ELSE 'en' END,
       race, gender, deceased
FROM staging.person_key;

-- map each case to its person
DROP TABLE IF EXISTS staging.case_person;
CREATE TABLE staging.case_person AS
SELECT l.case_id, p.person_id
FROM staging.case_link l
JOIN staging.person_key p
  ON lower(p.firstname)=lower(l.firstname)
 AND lower(p.lastname)=lower(l.lastname)
 AND p.dob_raw IS NOT DISTINCT FROM l.dob_raw;

-- ------------------------------------------------------------
-- 4. Contact points (from the first case row per person)
-- ------------------------------------------------------------
WITH src AS (
  SELECT DISTINCT ON (cp.person_id) cp.person_id, l.phone, l.email,
         l.address, l.client_city, l.client_state, l.client_zip
  FROM staging.case_person cp JOIN staging.case_link l USING (case_id)
  ORDER BY cp.person_id, l.case_id
)
INSERT INTO core.contact_point (person_id, kind, label, phone, email,
                                address_line1, city, state, zip, is_primary)
SELECT person_id, k.kind, 'migrated',
       CASE WHEN k.kind='phone' THEN s.phone END,
       CASE WHEN k.kind='email' THEN s.email END::citext,
       CASE WHEN k.kind='address' THEN s.address END,
       CASE WHEN k.kind='address' THEN s.client_city END,
       CASE WHEN k.kind='address' THEN s.client_state END,
       CASE WHEN k.kind='address' THEN s.client_zip END,
       true
FROM src s
CROSS JOIN (VALUES ('phone'),('email'),('address')) k(kind)
WHERE (k.kind='phone' AND s.phone IS NOT NULL)
   OR (k.kind='email' AND s.email IS NOT NULL)
   OR (k.kind='address' AND s.address IS NOT NULL);

-- ------------------------------------------------------------
-- 5. Incident groups (one per case for now; dup-pair merge after review)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.case_incident;
CREATE TABLE staging.case_incident AS
SELECT case_id, gen_random_uuid() AS incident_group_id FROM staging.case_link;

INSERT INTO core.incident_group (incident_group_id, date_of_loss, case_type_code,
       incident_label, incident_address, incident_city, incident_state, multiple_clients)
SELECT ci.incident_group_id,
       to_date(l.doi,'MM/DD/YYYY'),
       coalesce(tm.code,'other'),
       l.case_name,
       l.incident_address,
       l.oc_city,                          -- VERIFY: assumed incident city
       coalesce(l.incident_state,'TX'),
       l.multi_client_flag
FROM staging.case_incident ci
JOIN staging.case_link l USING (case_id)
LEFT JOIN staging.case_type_map tm ON tm.cp_type = l.case_type;

-- ------------------------------------------------------------
-- 6. Intake leads
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.case_lead;
CREATE TABLE staging.case_lead AS
SELECT case_id, gen_random_uuid() AS intake_lead_id FROM staging.case_link;

INSERT INTO core.intake_lead (intake_lead_id, person_id, contact_date, incident_date,
       case_type_code, intake_source, referral_source, estimated_sol_date, status)
SELECT cl.intake_lead_id, cp.person_id,
       coalesce(to_date(l.intake,'MM/DD/YYYY'), to_date(l.doi,'MM/DD/YYYY')),
       to_date(l.doi,'MM/DD/YYYY'),
       coalesce(tm.code,'other'),
       coalesce(l.source_type, l.c_referral_source),
       coalesce(l.o_source_detail, l.c_source_detail, l.referred_by),
       to_date(l.statute,'MM/DD/YYYY'),
       'signed'
FROM staging.case_lead cl
JOIN staging.case_link l USING (case_id)
JOIN staging.case_person cp USING (case_id)
LEFT JOIN staging.case_type_map tm ON tm.cp_type = l.case_type;

-- ------------------------------------------------------------
-- 7. Client matters (sign-up gate paused for this step only)
-- ------------------------------------------------------------
ALTER TABLE core.client_matter DISABLE TRIGGER trg_matter_signup_minimums;

DROP TABLE IF EXISTS staging.case_matter;
CREATE TABLE staging.case_matter AS
SELECT case_id, gen_random_uuid() AS client_matter_id FROM staging.case_link;

INSERT INTO core.client_matter (client_matter_id, incident_group_id, client_person_id,
       casepeer_case_id, client_role, current_stage_code, sign_up_date, contract_signed_date,
       sol_date, sol_status, intake_source, referral_source, marketing_source)
SELECT cm.client_matter_id, ci.incident_group_id, cp.person_id,
       l.case_id,
       'other',                            -- role unknown in export
       coalesce(sm.stage,'intake'),
       to_date(l.retained,'MM/DD/YYYY'),
       to_date(l.retained,'MM/DD/YYYY'),
       to_date(l.statute,'MM/DD/YYYY'),
       'needs_review',
       coalesce(l.source_type, l.c_referral_source),
       coalesce(l.o_source_detail, l.c_source_detail),
       l.referred_by
FROM staging.case_matter cm
JOIN staging.case_link l USING (case_id)
JOIN staging.case_incident ci USING (case_id)
JOIN staging.case_person cp USING (case_id)
LEFT JOIN staging.status_map sm ON sm.cp_status = l.case_status;

ALTER TABLE core.client_matter ENABLE TRIGGER trg_matter_signup_minimums;

UPDATE core.intake_lead il SET resulting_matter_id = cm.client_matter_id
FROM staging.case_lead cl
JOIN staging.case_matter cm USING (case_id)
WHERE il.intake_lead_id = cl.intake_lead_id;

-- ------------------------------------------------------------
-- 8. Limitations analysis stubs
-- ------------------------------------------------------------
INSERT INTO core.limitations_analysis (client_matter_id, governing_statute,
       base_accrual_date, analysis_notes)
SELECT cm.client_matter_id, 'CPRC 16.003 (2 yr) - VERIFY',
       to_date(l.doi,'MM/DD/YYYY'),
       'Migrated stub. CasePeer statute date = ' || coalesce(l.statute,'(none)') ||
       '. computed_sol_date to be populated by SOL engine (MF-02).'
FROM staging.case_matter cm
JOIN staging.case_link l USING (case_id);

-- ------------------------------------------------------------
-- 9. Notes (only for the 770 open cases; closed-case notes stay in staging)
-- ------------------------------------------------------------
INSERT INTO workflow.note (entity_id, author_staff_id, note_type, body, pinned, created_at)
SELECT cm.client_matter_id,
       sm.staff_id,
       coalesce(nullif(regexp_replace(lower(split_part(n.category,',',1)),'[^a-z0-9]+','_','g'),''),'general'),
       n.note ||
         CASE WHEN n.directed_to IS NOT NULL AND n.directed_to NOT IN ('[]','')
              THEN e'\n[Directed to: ' || n.directed_to || ']' ELSE '' END,
       false,
       coalesce(
         to_timestamp(nullif(trim(n."date"),''),'MM/DD/YYYY HH12:MI AM'),
         now()
       )
FROM staging.notes n
JOIN staging.case_matter cm ON cm.case_id = n.case_id
LEFT JOIN staging.staff_map sm ON sm.cp_name = trim(n.added_by)
WHERE nullif(trim(n.note),'') IS NOT NULL;

-- critical case notes -> pinned
INSERT INTO workflow.note (entity_id, author_staff_id, note_type, body, pinned, created_at)
SELECT cm.client_matter_id,
       (SELECT staff_id FROM staging.staff_map WHERE cp_name='CasePeer Migration'),
       'critical',
       'CASEPEER CRITICAL CASE NOTE: ' || l.critical_case_note,
       true, now()
FROM staging.case_matter cm
JOIN staging.case_link l USING (case_id)
WHERE l.critical_case_note IS NOT NULL;

-- ------------------------------------------------------------
-- 10. Communication log: last client contact
-- ------------------------------------------------------------
INSERT INTO workflow.communication_log (client_matter_id, person_id, staff_id, channel,
       direction, occurred_at, summary)
SELECT cm.client_matter_id, cp.person_id,
       (SELECT staff_id FROM staging.staff_map WHERE cp_name='CasePeer Migration'),
       'call','outbound',
       to_date(l.client_comm,'MM/DD/YYYY')::timestamptz,
       'CasePeer: last recorded client communication'
FROM staging.case_matter cm
JOIN staging.case_link l USING (case_id)
JOIN staging.case_person cp USING (case_id)
WHERE l.client_comm IS NOT NULL;

-- ------------------------------------------------------------
-- 11. Migration flags
-- ------------------------------------------------------------
DROP TABLE IF EXISTS staging.migration_flags;
CREATE TABLE staging.migration_flags (case_id text, flag text, detail text);
INSERT INTO staging.migration_flags
SELECT case_id, 'missing_email', NULL FROM staging.case_link WHERE email IS NULL
UNION ALL
SELECT case_id, 'missing_address', NULL FROM staging.case_link WHERE address IS NULL
UNION ALL
SELECT case_id, 'missing_phone', NULL FROM staging.case_link WHERE phone IS NULL
UNION ALL
SELECT case_id, 'missing_retained_date', NULL FROM staging.case_link WHERE retained IS NULL
UNION ALL
SELECT case_id, 'language_defaulted_en', NULL FROM staging.case_link WHERE language IS NULL
UNION ALL
SELECT l.case_id, sm.flag, l.case_status FROM staging.case_link l
  JOIN staging.status_map sm ON sm.cp_status=l.case_status WHERE sm.flag IS NOT NULL
UNION ALL
SELECT l.case_id, tm.flag, l.case_type FROM staging.case_link l
  JOIN staging.case_type_map tm ON tm.cp_type=l.case_type WHERE tm.flag IS NOT NULL
UNION ALL
SELECT case_id, 'duplicate_name_pair', case_name FROM staging.case_link
 WHERE case_name IN (SELECT case_name FROM staging.case_link GROUP BY case_name HAVING count(*)>1)
UNION ALL
SELECT case_id, 'client_role_unknown_set_other', NULL FROM staging.case_link;

COMMIT;
