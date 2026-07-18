-- ============================================================================
-- TUTTLE LAW FIRM — PRACTICE MANAGEMENT DATABASE
-- PostgreSQL 16+  |  Intake → Pre-Litigation → Litigation → Disbursement (Texas)
-- v2.0  |  2026-07-06  |  93 tables, 8 dashboard views, 12 schemas
--
-- Consolidated release. Everything below is validated end-to-end against a
-- live PostgreSQL instance (full functional test suite passing).
--
-- WHAT THIS COVERS
--   ref         lookup/seed data: stages, case & party types, lien types,
--               document types, courts, holidays, TEXAS DEADLINE RULES
--   core        persons, orgs, staff, intake leads, incident groups, client
--               matters, linked-matter conflicts, liability assessment,
--               limitations analysis, sign-up gate + signature automation
--   workflow    universal tasks/deadlines/notes/documents/issue flags,
--               deadline engine, viability review, communication & decision
--               logs, TEMPLATES (Word/Excel/email + merge fields + generation
--               log), public records requests (FOIA / TX PIA / DPS records)
--   insurance   policies (incl. client health), claims, coverage assessment
--               (the Level inputs)
--   medical     providers, treatment episodes, bi-weekly provider call
--               automation, injuries, clinical events, record requests,
--               bills, 18.001 affidavits, wage loss
--   property    vehicles, PD claims (total loss / rental / LOU / DV)
--   liens       early lien screen, liens, Medicare detail, lien events
--   resolution  demands (Stowers), per-defendant negotiation, settlements
--               (partial/global), releases
--   litigation  court cases (TRCP 190, removal, HB 19, Rule 202 / friendly
--               suits), per-defendant parties/service/answer tracking,
--               scheduling orders that SUPERSEDE rule-based deadlines,
--               written discovery to the individual-request level,
--               productions, depositions, experts, motions, hearings,
--               mediation, trial, judgment, per-defendant 18.001 windows
--   finance     fee agreements & 1.04(f) splits, case expenses, IOLTA trust
--               ledger (overdraft-proof), disbursement statements (math-
--               checked)
--   audit       physically immutable row-level change log
--   analytics   closed-case valuation snapshots
--
-- KEY GUARANTEES (enforced by the database itself, not by convention)
--   * a matter needs SIX minimums before it can exist: client name,
--     incident type, incident date, injury location (city/county/description),
--     phone, and email (in-person-signing checkbox waives email only)
--   * marking the engagement contract executed auto-opens the 7-day
--     viability review and creates the sign-up checklist
--   * only authorized staff can approve/change a Level (session-attributed)
--   * cross-matter note copying is blocked until pairwise conflict clearance
--   * the trust ledger cannot go negative per matter — on insert OR update
--   * disbursement statements must balance to the penny
--   * exactly one open stage per matter; one active holder per staff role
--   * the audit log cannot be updated or deleted
--   * deadline math: Gov''t Code 311.014 month/year units, TRCP 99
--     strictly-after Monday, TRCP 21a mail +3, backward-counted deadlines
--     roll EARLIER, court scheduling orders supersede rule defaults
--
-- RELIANCE NOTE: every seeded deadline rule is attorney-verify-before-
-- reliance. Rule text changes; county holiday calendars vary. See
-- SCHEMA_REVIEW_2026-07-06.md for the full review trail.
--
-- Conventions:
--   * uuid primary keys (gen_random_uuid); use UUIDv7 in app layer if desired
--   * created_at/updated_at maintained by trigger on every mutable table
--   * soft delete via deleted_at on business tables (logs are append-only)
--   * money = numeric(14,2); all timestamps = timestamptz; pure dates = date
--   * enumerations live in ref.* lookup tables (editable without migration)
--   * "entity registry" (core.entity) lets universal tables (task, note,
--     document, issue_flag, audit) attach to ANY business object with real
--     foreign-key integrity
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid, digest
CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- exclusion constraints on uuid
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- type-ahead / fuzzy search indexes
CREATE EXTENSION IF NOT EXISTS vector;        -- semantic search embeddings (pgvector)

CREATE SCHEMA IF NOT EXISTS ref;        -- lookup / seed data
CREATE SCHEMA IF NOT EXISTS core;       -- parties, matters, staffing, conflicts
CREATE SCHEMA IF NOT EXISTS workflow;   -- tasks, deadlines, notes, docs, flags
CREATE SCHEMA IF NOT EXISTS insurance;  -- policies, claims, coverage analysis
CREATE SCHEMA IF NOT EXISTS medical;    -- providers, treatment, records, bills
CREATE SCHEMA IF NOT EXISTS property;   -- vehicles, property damage claims
CREATE SCHEMA IF NOT EXISTS liens;      -- liens & subrogation
CREATE SCHEMA IF NOT EXISTS resolution; -- demands, negotiation, settlement
CREATE SCHEMA IF NOT EXISTS litigation; -- suits, discovery, depos, trial
CREATE SCHEMA IF NOT EXISTS finance;    -- fees, expenses, trust, disbursement
CREATE SCHEMA IF NOT EXISTS audit;      -- immutable change log
CREATE SCHEMA IF NOT EXISTS analytics;  -- closed-case valuation snapshots

-- ---------------------------------------------------------------------------
-- Helper: updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Entity registry.  Every major business row also registers here so that
-- universal tables can FK to one place.  Populated automatically by trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE core.entity (
  entity_id   uuid PRIMARY KEY,
  entity_type text NOT NULL,          -- e.g. 'client_matter', 'deposition'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION core.register_entity() RETURNS trigger AS $$
BEGIN
  -- TG_ARGV[0] = name of the PK column, TG_ARGV[1] = entity_type label
  INSERT INTO core.entity (entity_id, entity_type)
  VALUES ((to_jsonb(NEW) ->> TG_ARGV[0])::uuid, TG_ARGV[1]);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION core.unregister_entity() RETURNS trigger AS $$
BEGIN
  DELETE FROM core.entity WHERE entity_id = (to_jsonb(OLD) ->> TG_ARGV[0])::uuid;
  RETURN OLD;
END $$ LANGUAGE plpgsql;

-- Convenience: attach both registry triggers + updated_at to a table
CREATE OR REPLACE FUNCTION core.instrument_table(p_schema text, p_table text,
                                                 p_pk text, p_type text)
RETURNS void AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER trg_%s_register AFTER INSERT ON %I.%I
       FOR EACH ROW EXECUTE FUNCTION core.register_entity(%L, %L)',
    p_table, p_schema, p_table, p_pk, p_type);
  EXECUTE format(
    'CREATE TRIGGER trg_%s_unregister AFTER DELETE ON %I.%I
       FOR EACH ROW EXECUTE FUNCTION core.unregister_entity(%L)',
    p_table, p_schema, p_table, p_pk);
  EXECUTE format(
    'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %I.%I
       FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at()',
    p_table, p_schema, p_table);
END $$ LANGUAGE plpgsql;

-- ============================================================================
-- REFERENCE / LOOKUP TABLES (seeded at bottom of this file)
-- ============================================================================
CREATE TABLE ref.case_type (
  code text PRIMARY KEY, label text NOT NULL, sort int DEFAULT 0
);
CREATE TABLE ref.matter_stage (
  code text PRIMARY KEY, label text NOT NULL, sort int NOT NULL,
  is_terminal boolean NOT NULL DEFAULT false
);
CREATE TABLE ref.party_role (
  code text PRIMARY KEY, label text NOT NULL,
  side text NOT NULL CHECK (side IN ('client','adverse','neutral','other'))
);
CREATE TABLE ref.staff_role (
  code text PRIMARY KEY, label text NOT NULL
);
CREATE TABLE ref.lien_type (
  code text PRIMARY KEY, label text NOT NULL,
  federal boolean NOT NULL DEFAULT false, statute_cite text
);
CREATE TABLE ref.document_type (
  code text PRIMARY KEY, label text NOT NULL, category text
);
CREATE TABLE ref.expense_category (
  code text PRIMARY KEY, label text NOT NULL, taxable_cost boolean DEFAULT false
);
CREATE TABLE ref.clinical_event_type (
  code text PRIMARY KEY, label text NOT NULL,
  value_signal boolean NOT NULL DEFAULT false   -- MRI, injection, surgery, etc.
);
CREATE TABLE ref.court (
  court_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  court_type text NOT NULL CHECK
    (court_type IN ('jp','county','district','federal_district','appellate','other')),
  county text, state text NOT NULL DEFAULT 'TX',
  judge_name text, coordinator_name text, coordinator_phone text,
  coordinator_email citext, efile_notes text, local_rules_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ref.court_holiday (
  holiday_date date PRIMARY KEY, label text NOT NULL
);
-- Texas deadline computation rules (seed set at bottom; attorney-verified)
CREATE TABLE ref.deadline_rule (
  code text PRIMARY KEY,
  label text NOT NULL,
  authority text,                       -- statute / rule citation
  day_count int,                        -- signed offset from base event
  count_unit text NOT NULL DEFAULT 'day'
    CHECK (count_unit IN ('day','month','year')),
    -- month/year use calendar arithmetic per Tex. Gov't Code 311.014
    -- (e.g., "six months" = same numbered day six months later, NOT 182 days)
  count_method text NOT NULL DEFAULT 'calendar'
    CHECK (count_method IN ('calendar','business')),
  roll_rule text NOT NULL DEFAULT 'next_business'
    CHECK (roll_rule IN ('none','next_business','next_monday','prev_business')),
    -- prev_business is REQUIRED for backward-counted deadlines (negative
    -- day_count): rolling forward would land past the true deadline
  service_mail_extension boolean NOT NULL DEFAULT false,  -- TRCP 21a +3 days
  jurisdictional boolean NOT NULL DEFAULT false,
  applies_to text NOT NULL DEFAULT 'both'
    CHECK (applies_to IN ('prelit','litigation','both')),
  notes text
);

-- ============================================================================
-- CORE: PEOPLE, ORGANIZATIONS, CONTACT DATA
-- ============================================================================
CREATE TABLE core.person (
  person_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  suffix text,
  goes_by text,
  date_of_birth date,
  date_of_death date,
  ssn_last4 text CHECK (ssn_last4 ~ '^[0-9]{4}$'),
  drivers_license_no text, drivers_license_state text,
  preferred_language text NOT NULL DEFAULT 'en',
  is_minor_override boolean,            -- manual override; else derive from DOB
  is_incapacitated boolean NOT NULL DEFAULT false,
  gender text,                           -- as reported; med records requests need it
  race_ethnicity text,                   -- optional, as reported
  is_deceased boolean NOT NULL DEFAULT false,  -- CasePeer parity; date may be unknown
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_person_name ON core.person (lower(last_name), lower(first_name));

CREATE TABLE core.organization (
  organization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_type text NOT NULL CHECK (org_type IN
    ('insurance_carrier','law_firm','medical_provider','employer','business',
     'governmental_unit','lienholder_financial','records_vendor','court_vendor',
     'process_server','expert_firm','other')),
  fein text, usdot_number text, tx_sos_file_number text,
  registered_agent_name text, registered_agent_address text,
  main_phone text, main_fax text, main_email citext, website text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_org_name ON core.organization (lower(name));

-- Phone / email / address points.  Exclusive arc: person XOR organization.
CREATE TABLE core.contact_point (
  contact_point_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES core.person(person_id) ON DELETE CASCADE,
  organization_id uuid REFERENCES core.organization(organization_id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('phone','email','address','fax')),
  label text,                            -- cell, work, billing, records dept...
  phone text,
  phone_extension text,
    -- "main line + ext 4417": extension lives here, NEVER inside phone.
    -- phone_e164 stays the clean dialable/matchable base number; the UI
    -- shows the extension after connect (and appends ';ext=' where the
    -- dialer supports post-dial digits)
  phone_e164 text,
    -- normalized dialable form (+12105551212), auto-maintained by trigger.
    -- Click-to-call sends this to RingCentral; inbound webhooks match on it
    -- to auto-log calls to the right client/matter.
  email citext,
  address_line1 text, address_line2 text,
  city text, state text, zip text, county text, country text DEFAULT 'US',
  is_primary boolean NOT NULL DEFAULT false,
  sms_consent boolean,                   -- TCPA/10DLC posture for RingCentral
  sms_consent_date date,
  do_not_contact boolean NOT NULL DEFAULT false,
  valid_from date, valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_owner_arc CHECK (num_nonnulls(person_id, organization_id) = 1),
  CONSTRAINT contact_payload CHECK (
    (kind = 'phone'   AND phone IS NOT NULL) OR
    (kind = 'fax'     AND phone IS NOT NULL) OR
    (kind = 'email'   AND email IS NOT NULL) OR
    (kind = 'address' AND address_line1 IS NOT NULL))
);
CREATE INDEX idx_contact_person ON core.contact_point (person_id);
CREATE INDEX idx_contact_org ON core.contact_point (organization_id);
CREATE INDEX idx_contact_e164 ON core.contact_point (phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- Normalize phone -> E.164 on write. US-default: 10 digits get +1; 11 digits
-- leading 1 get +; numbers entered with + keep their country code as typed.
CREATE OR REPLACE FUNCTION core.normalize_phone_e164() RETURNS trigger AS $$
DECLARE digits text;
BEGIN
  IF NEW.kind IN ('phone','fax') AND NEW.phone IS NOT NULL THEN
    digits := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
    IF left(trim(NEW.phone), 1) = '+' THEN
      NEW.phone_e164 := '+' || digits;
    ELSIF length(digits) = 10 THEN
      NEW.phone_e164 := '+1' || digits;
    ELSIF length(digits) = 11 AND left(digits,1) = '1' THEN
      NEW.phone_e164 := '+' || digits;
    ELSE
      NEW.phone_e164 := NULL;   -- unparseable: surfaces as a data-quality gap
    END IF;
  ELSIF NEW.kind IN ('phone','fax') THEN
    NEW.phone_e164 := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_phone_e164
  BEFORE INSERT OR UPDATE OF phone ON core.contact_point
  FOR EACH ROW EXECUTE FUNCTION core.normalize_phone_e164();

-- ============================================================================
-- CORE: STAFF & APPLICATION USERS
-- ============================================================================
CREATE TABLE core.staff (
  staff_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES core.person(person_id),
  role_code text NOT NULL REFERENCES ref.staff_role(code),
  bar_number text,                       -- attorneys only
  email citext UNIQUE,
  is_attorney boolean NOT NULL DEFAULT false,
  can_approve_level boolean NOT NULL DEFAULT false,   -- Michael, Daniel B.
  can_clear_conflicts boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  hired_date date, separated_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- CORE: INTAKE LEADS (pre-signature; rejected-case log lives here)
-- ============================================================================
CREATE TABLE core.intake_lead (
  intake_lead_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES core.person(person_id),
  raw_name text,                         -- before a person record exists
  raw_phone text, raw_email citext,
  contact_date date NOT NULL DEFAULT CURRENT_DATE,
  incident_date date,
  case_type_code text REFERENCES ref.case_type(code),
  description text,
  intake_source text,                    -- phone, web, walk-in, referral
  referral_source text,                  -- who referred
  marketing_source text,                 -- campaign attribution
  estimated_sol_date date,               -- ALWAYS compute, even for rejects
  status text NOT NULL DEFAULT 'open' CHECK (status IN
    ('open','contract_sent','signed','rejected','referred_out',
     'no_response','duplicate')),
  rejected_reason text,
  non_engagement_letter_sent date,       -- malpractice control
  referred_out_to text,
  handled_by uuid REFERENCES core.staff(staff_id),
  resulting_matter_id uuid,              -- FK added after client_matter exists
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- CORE: INCIDENT GROUP  (one loss event; shared facts)
-- ============================================================================
CREATE TABLE core.incident_group (
  incident_group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_of_loss date NOT NULL,
  time_of_loss time,
  case_type_code text NOT NULL REFERENCES ref.case_type(code),
  incident_label text,                   -- optional human label
  -- location / venue
  incident_address text, incident_city text,
  incident_county text, incident_state text NOT NULL DEFAULT 'TX',
  incident_location_description text,
    -- fallback when city (1st choice) and county (2nd choice) are unknown:
    -- a description of the place ("HEB parking lot off I-35 near Schertz")
  nearest_geography text,
  likely_venue_county text, venue_notes text,
  -- police / investigation
  police_agency text, police_report_number text,
  report_ordered_date date, report_received_date date,
  citations_summary text,
  photos_available boolean, video_available boolean,
  dashcam_or_surveillance boolean,
  preservation_needed boolean, preservation_letter_sent date,
  -- special theory flags
  commercial_vehicle boolean NOT NULL DEFAULT false,
  rideshare boolean NOT NULL DEFAULT false,
  trucking_fmcsr boolean NOT NULL DEFAULT false,
  premises boolean NOT NULL DEFAULT false,
  governmental_entity_involved boolean NOT NULL DEFAULT false,
  dram_shop boolean NOT NULL DEFAULT false,
  product_liability boolean NOT NULL DEFAULT false,
  work_injury_nonsubscriber boolean NOT NULL DEFAULT false,
  wrongful_death boolean NOT NULL DEFAULT false,
  -- group conflict posture (pairwise detail in representation_link)
  multiple_clients boolean NOT NULL DEFAULT false,
  driver_passenger_issue boolean NOT NULL DEFAULT false,
  limits_short_issue boolean NOT NULL DEFAULT false,
  joint_rep_required boolean NOT NULL DEFAULT false,
  conflict_status text NOT NULL DEFAULT 'not_applicable' CHECK (conflict_status IN
    ('not_applicable','pending_review','cleared','waived_in_writing','blocked')),
  conflict_cleared_by uuid REFERENCES core.staff(staff_id),
  conflict_cleared_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_incident_dol ON core.incident_group (date_of_loss);

-- ============================================================================
-- CORE: CLIENT MATTER  (one represented client's claim)
-- ============================================================================
CREATE TABLE core.client_matter (
  client_matter_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_group_id uuid NOT NULL
    REFERENCES core.incident_group(incident_group_id),
  client_person_id uuid NOT NULL REFERENCES core.person(person_id),
  matter_number text UNIQUE,             -- firm file number (human-facing)
  casepeer_case_id text,                 -- external system key
  dropbox_root_path text,
  client_role text NOT NULL CHECK (client_role IN
    ('driver','passenger','pedestrian','bicyclist','owner_non_occupant',
     'worker','patron','next_friend','estate_representative','other')),
  minor_or_incapacitated boolean NOT NULL DEFAULT false,
  next_friend_person_id uuid REFERENCES core.person(person_id),
  representation_status text NOT NULL DEFAULT 'active' CHECK
    (representation_status IN ('active','declined','withdrawn','terminated',
                               'transferred_out','completed')),
  -- stage (current pointer; history in core.stage_history)
  current_stage text NOT NULL DEFAULT 'intake' REFERENCES ref.matter_stage(code),
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  -- key dates
  sign_up_date date,
  contract_signed_date date,
  in_person_signing boolean NOT NULL DEFAULT false,
    -- checkbox: client will sign in office / has no email access.
    -- Overrides the email-required-at-sign-up gate; the missing email
    -- surfaces as a follow-up instead of blocking the matter.
  -- statute of limitations (detail in core.limitations_analysis)
  sol_date date,
  sol_status text NOT NULL DEFAULT 'needs_review' CHECK
    (sol_status IN ('calculated','needs_review','escalated','tolled','expired','satisfied_by_filing')),
  -- Level (history in workflow.decision_log; enforcement trigger below)
  recommended_level smallint CHECK (recommended_level BETWEEN 0 AND 3),
  recommended_level_rationale text,
  approved_level smallint CHECK (approved_level BETWEEN 0 AND 3),
  level_approved_by uuid REFERENCES core.staff(staff_id),
  level_approved_at timestamptz,
  -- client service profile
  preferred_contact text CHECK (preferred_contact IN
    ('phone','sms','email','mail','in_person')),
  distance_from_office_miles int,
  office_meeting_needed boolean,
  remote_docs_needed boolean,
  communication_reliability text CHECK (communication_reliability IN
    ('good','fair','poor','unreachable')),
  -- client risk flags
  credibility_concern boolean NOT NULL DEFAULT false,
  unrealistic_expectations boolean NOT NULL DEFAULT false,
  criminal_history_material boolean NOT NULL DEFAULT false,
  improper_solicitation_concern boolean NOT NULL DEFAULT false,
  prior_attorney_on_claim boolean NOT NULL DEFAULT false,
  -- intake attribution (feeds valuation dataset)
  intake_source text, referral_source text, marketing_source text,
  -- disposition
  disposition text CHECK (disposition IN
    ('settled_prelit','settled_litigation','tried','rejected_post_signup',
     'withdrawn','client_terminated','referred_out','sol_missed','other')),
  close_date date, close_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_matter_incident ON core.client_matter (incident_group_id);
CREATE INDEX idx_matter_client ON core.client_matter (client_person_id);
CREATE INDEX idx_matter_stage ON core.client_matter (current_stage)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_matter_sol ON core.client_matter (sol_date)
  WHERE deleted_at IS NULL;

ALTER TABLE core.intake_lead
  ADD CONSTRAINT fk_lead_matter FOREIGN KEY (resulting_matter_id)
  REFERENCES core.client_matter(client_matter_id);

-- Display name (Casepeer style: "Last, First - YYYY.MM.DD +N") is DERIVED,
-- never stored, so it can never go stale:
CREATE OR REPLACE FUNCTION core.matter_display_name(p_matter uuid)
RETURNS text AS $$
  SELECT p.last_name || ', ' || p.first_name
         || ' - ' || to_char(ig.date_of_loss, 'YYYY.MM.DD')
         || CASE WHEN cnt.n > 1 THEN ' +' || (cnt.n - 1)::text ELSE '' END
  FROM core.client_matter m
  JOIN core.person p ON p.person_id = m.client_person_id
  JOIN core.incident_group ig ON ig.incident_group_id = m.incident_group_id
  JOIN LATERAL (
    -- count everyone the firm actually represented in this incident;
    -- a matter that later completes/withdraws still counts, so display
    -- names don't silently mutate when a linked case closes
    SELECT count(*) AS n FROM core.client_matter m2
    WHERE m2.incident_group_id = m.incident_group_id
      AND m2.deleted_at IS NULL
      AND m2.representation_status <> 'declined'
  ) cnt ON true
  WHERE m.client_matter_id = p_matter;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- CORE: PARTIES ON AN INCIDENT/MATTER  (adverse parties, witnesses, etc.)
-- ============================================================================
CREATE TABLE core.matter_party (
  matter_party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_group_id uuid REFERENCES core.incident_group(incident_group_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  person_id uuid REFERENCES core.person(person_id),
  organization_id uuid REFERENCES core.organization(organization_id),
  role_code text NOT NULL REFERENCES ref.party_role(code),
  details text,
  in_course_and_scope boolean,           -- employee driver → respondeat superior
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT party_scope_arc CHECK (num_nonnulls(incident_group_id, client_matter_id) = 1),
  CONSTRAINT party_who_arc CHECK (num_nonnulls(person_id, organization_id) = 1)
);
CREATE INDEX idx_party_incident ON core.matter_party (incident_group_id);
CREATE INDEX idx_party_person ON core.matter_party (person_id);
CREATE INDEX idx_party_org ON core.matter_party (organization_id);

-- ============================================================================
-- CORE: LINKED-MATTER RELATIONSHIPS & CONFLICT CLEARANCE (pairwise)
-- ============================================================================
CREATE TABLE core.representation_link (
  representation_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_a uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  matter_b uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  relationship text,                     -- spouse, parent/child, co-worker...
  joint_representation boolean NOT NULL DEFAULT false,
  conflict_status text NOT NULL DEFAULT 'pending_review' CHECK (conflict_status IN
    ('pending_review','cleared','waived_in_writing','blocked')),
  waiver_document_id uuid,               -- FK to workflow.document added later
  cleared_by uuid REFERENCES core.staff(staff_id),
  cleared_date date,
  copy_sharing_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_ordered CHECK (matter_a < matter_b),
  CONSTRAINT link_unique UNIQUE (matter_a, matter_b)
);

-- ============================================================================
-- CORE: STAFF ASSIGNMENT (with history) & STAGE HISTORY
-- ============================================================================
CREATE TABLE core.staff_assignment (
  staff_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES core.staff(staff_id),
  assignment_role text NOT NULL REFERENCES ref.staff_role(code),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  assigned_by uuid REFERENCES core.staff(staff_id),
  -- only one ACTIVE holder of a given role per matter:
  CONSTRAINT one_active_per_role EXCLUDE USING gist (
    client_matter_id WITH =, assignment_role WITH =)
    WHERE (ended_at IS NULL)
);
CREATE INDEX idx_assignment_staff ON core.staff_assignment (staff_id)
  WHERE ended_at IS NULL;

CREATE TABLE core.stage_history (
  stage_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  stage_code text NOT NULL REFERENCES ref.matter_stage(code),
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  changed_by uuid REFERENCES core.staff(staff_id),
  note text,
  CONSTRAINT one_open_stage EXCLUDE USING gist (client_matter_id WITH =)
    WHERE (exited_at IS NULL)
);
CREATE INDEX idx_stagehist_matter ON core.stage_history (client_matter_id);

-- Keep client_matter.current_stage and stage_history in sync automatically.
-- Two triggers: BEFORE stamps the entered_at timestamp on the matter row;
-- AFTER writes history (the matter row must exist before history can FK it).
CREATE OR REPLACE FUNCTION core.sync_stage_entered() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    NEW.stage_entered_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION core.sync_stage_history() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    UPDATE core.stage_history
       SET exited_at = now()
     WHERE client_matter_id = NEW.client_matter_id AND exited_at IS NULL;
    INSERT INTO core.stage_history (client_matter_id, stage_code)
    VALUES (NEW.client_matter_id, NEW.current_stage);
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matter_stage_stamp
  BEFORE INSERT OR UPDATE OF current_stage ON core.client_matter
  FOR EACH ROW EXECUTE FUNCTION core.sync_stage_entered();

CREATE TRIGGER trg_matter_stage_sync
  AFTER INSERT OR UPDATE OF current_stage ON core.client_matter
  FOR EACH ROW EXECUTE FUNCTION core.sync_stage_history();

-- Sign-up gate — SIX minimums before a matter can exist:
-- (1) full client name  (2) incident type  (3) incident date  — structural
-- (4) injury location (city, else county, else description) — checked below
-- (5) client PHONE — checked below, no override
-- (6) client email — checked below; the in-person-signing checkbox is the
--     only override, and it waives EMAIL ONLY.
CREATE OR REPLACE FUNCTION core.require_signup_minimums() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM core.contact_point cp
     WHERE cp.person_id = NEW.client_person_id
       AND cp.kind = 'phone' AND cp.phone IS NOT NULL)
  THEN
    RAISE EXCEPTION 'cannot open matter: client % has no phone number on file (required at sign-up)',
      NEW.client_person_id;
  END IF;
  -- injury LOCATION is a sign-up minimum: city (1st choice), county (2nd),
  -- or a description of the place when neither is known
  IF NOT EXISTS (
    SELECT 1 FROM core.incident_group ig
     WHERE ig.incident_group_id = NEW.incident_group_id
       AND coalesce(ig.incident_city, ig.incident_county,
                    ig.incident_location_description) IS NOT NULL)
  THEN
    RAISE EXCEPTION 'cannot open matter: incident location required — enter city (preferred), county, or a description of the place';
  END IF;
  IF NOT NEW.in_person_signing AND NOT EXISTS (
    SELECT 1 FROM core.contact_point cp
     WHERE cp.person_id = NEW.client_person_id
       AND cp.kind = 'email' AND cp.email IS NOT NULL)
  THEN
    RAISE EXCEPTION 'cannot open matter: client % has no email address on file (required at sign-up, or check in-person signing)',
      NEW.client_person_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matter_signup_minimums
  BEFORE INSERT ON core.client_matter
  FOR EACH ROW EXECUTE FUNCTION core.require_signup_minimums();

-- Signature automation: when the engagement contract document flips to
-- 'executed', the database (1) stamps the matter's contract/sign-up dates,
-- (2) opens the 7-day viability review, and (3) creates the sign-up
-- checklist tasks, owned by the assigned Case Manager.
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
       'Open insurance claims and send LORs', v_cm, v_signed + 3, 'high', 'contract_signed'),
      (v_matter, v_matter, 'signup_checklist',
       'Order police / crash report', v_cm, v_signed + 3, 'normal', 'contract_signed'),
      (v_matter, v_matter, 'signup_checklist',
       'Complete Case Profile for 7-day review', v_cm, v_signed + 5, 'high', 'contract_signed'),
      (v_matter, v_matter, 'signup_checklist',
       'Confirm SOL calculation / limitations analysis', v_cm, v_signed + 5, 'critical', 'contract_signed');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- (trigger attached after workflow.document is created, below)

-- Level approval enforcement: only staff flagged can_approve_level may set
-- approved_level.  App layer sets: SET app.staff_id = '<uuid>' per session.
CREATE OR REPLACE FUNCTION core.enforce_level_approval() RETURNS trigger AS $$
DECLARE v_staff uuid; v_ok boolean;
BEGIN
  IF NEW.approved_level IS DISTINCT FROM OLD.approved_level
     OR (TG_OP = 'INSERT' AND NEW.approved_level IS NOT NULL) THEN
    v_staff := nullif(current_setting('app.staff_id', true), '')::uuid;
    IF v_staff IS NULL THEN
      RAISE EXCEPTION 'approved_level requires an authenticated staff session';
    END IF;
    SELECT can_approve_level INTO v_ok FROM core.staff WHERE staff_id = v_staff;
    IF NOT coalesce(v_ok, false) THEN
      RAISE EXCEPTION 'staff % is not authorized to approve or change Level', v_staff;
    END IF;
    NEW.level_approved_by := v_staff;
    NEW.level_approved_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matter_level_guard
  BEFORE INSERT OR UPDATE OF approved_level ON core.client_matter
  FOR EACH ROW EXECUTE FUNCTION core.enforce_level_approval();

-- ============================================================================
-- CORE: CONFLICT CHECKS (searchable record that the check was run)
-- ============================================================================
CREATE TABLE core.conflict_check (
  conflict_check_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_lead_id uuid REFERENCES core.intake_lead(intake_lead_id),
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id),
  run_by uuid NOT NULL REFERENCES core.staff(staff_id),
  run_at timestamptz NOT NULL DEFAULT now(),
  search_terms text NOT NULL,
  result text NOT NULL CHECK (result IN ('clear','hits_reviewed_clear','conflict_found')),
  notes text,
  CONSTRAINT conflict_check_scope CHECK
    (num_nonnulls(intake_lead_id, client_matter_id) >= 1)
);
CREATE TABLE core.conflict_check_hit (
  conflict_check_hit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_check_id uuid NOT NULL REFERENCES core.conflict_check(conflict_check_id) ON DELETE CASCADE,
  person_id uuid REFERENCES core.person(person_id),
  organization_id uuid REFERENCES core.organization(organization_id),
  matched_matter_id uuid REFERENCES core.client_matter(client_matter_id),
  disposition text NOT NULL DEFAULT 'pending' CHECK
    (disposition IN ('pending','not_a_conflict','waived','declined_representation'))
);

-- ============================================================================
-- CORE: LIMITATIONS & NOTICE ANALYSIS  (Texas deadline traps, per matter)
-- ============================================================================
CREATE TABLE core.limitations_analysis (
  limitations_analysis_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL UNIQUE
    REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  governing_statute text,                -- e.g. CPRC 16.003 (2 yr)
  base_accrual_date date,
  computed_sol_date date,
  tolling_minor boolean NOT NULL DEFAULT false,        -- CPRC 16.001
  tolling_incapacity boolean NOT NULL DEFAULT false,
  tolling_other text,
  wrongful_death_survival boolean NOT NULL DEFAULT false,
  ttca_notice_required boolean NOT NULL DEFAULT false, -- CPRC 101.101 (6 mo)
  ttca_notice_due date, ttca_notice_sent date,
  charter_notice_required boolean NOT NULL DEFAULT false, -- city charters: can be 45-90 days
  charter_notice_due date, charter_notice_sent date,
  dram_shop_notice boolean NOT NULL DEFAULT false,
  medmal_ch74_applies boolean NOT NULL DEFAULT false,  -- 60-day notice + expert report
  medmal_notice_sent date,
  analysis_notes text,
  reviewed_by uuid REFERENCES core.staff(staff_id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- CORE: LIABILITY ASSESSMENT  (planning doc §7 — structured fault facts)
-- Shared at incident level; optional per-matter override row when a client's
-- posture differs (driver vs passenger, comparative fault). Exclusive arc.
-- ============================================================================
CREATE TABLE core.liability_assessment (
  liability_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_group_id uuid REFERENCES core.incident_group(incident_group_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  fault_status text NOT NULL DEFAULT 'unknown' CHECK
    (fault_status IN ('clear','disputed','bad_facts','unknown')),
  liability_summary text,
  client_comparative_fault_pct int CHECK
    (client_comparative_fault_pct BETWEEN 0 AND 100),
  over_50_percent_concern boolean NOT NULL DEFAULT false,  -- CPRC 33.001 bar
  citations_issued boolean, cited_party text,
  report_fault_notes text,
  witnesses_identified boolean,
  witness_contact_status text,
  needs_attorney_review boolean NOT NULL DEFAULT false,
  assessed_by uuid REFERENCES core.staff(staff_id),
  assessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liability_scope_arc CHECK
    (num_nonnulls(incident_group_id, client_matter_id) = 1)
);
CREATE UNIQUE INDEX uq_liability_incident ON core.liability_assessment
  (incident_group_id) WHERE incident_group_id IS NOT NULL;
CREATE UNIQUE INDEX uq_liability_matter ON core.liability_assessment
  (client_matter_id) WHERE client_matter_id IS NOT NULL;

-- ============================================================================
-- WORKFLOW: UNIVERSAL ISSUE FLAGS  (your 4-value scale, one table, any entity)
-- ============================================================================
CREATE TABLE workflow.issue_flag (
  issue_flag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN
    ('deadline','liability','coverage','damages','treatment','liens','property_damage',
     'client','conflict','documents','litigation','financial','other')),
  severity text NOT NULL CHECK (severity IN
    ('no_issue','possible_issue','serious_issue','needs_review')),
  explanation text,
  raised_by uuid REFERENCES core.staff(staff_id),
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES core.staff(staff_id),
  resolved_at timestamptz,
  resolution_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flag_entity ON workflow.issue_flag (entity_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_flag_open ON workflow.issue_flag (severity) WHERE resolved_at IS NULL;

-- ============================================================================
-- WORKFLOW: TASKS & TICKLERS
-- ============================================================================
CREATE TABLE workflow.task (
  task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  task_type text NOT NULL,               -- free taxonomy; seed common in app
  title text NOT NULL,
  detail text,
  owner_staff_id uuid REFERENCES core.staff(staff_id),
  due_date date NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK
    (priority IN ('low','normal','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK
    (status IN ('open','in_progress','blocked','done','cancelled')),
  trigger_source text,                   -- signature, treatment_complete, demand_sent...
  escalation_level int NOT NULL DEFAULT 0,
  escalated_to uuid REFERENCES core.staff(staff_id),
  recurring_interval interval,           -- e.g. '14 days' for bi-weekly calls
  completed_at timestamptz,
  completed_by uuid REFERENCES core.staff(staff_id),
  created_by uuid REFERENCES core.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_owner_due ON workflow.task (owner_staff_id, due_date)
  WHERE status IN ('open','in_progress','blocked');
CREATE INDEX idx_task_matter ON workflow.task (client_matter_id);

-- ============================================================================
-- WORKFLOW: TEXAS DEADLINE ENGINE
-- ============================================================================
-- Business-day / weekend-holiday roll per TRCP 4 & Fed. R. Civ. P. 6 style.
CREATE OR REPLACE FUNCTION workflow.roll_forward(p date) RETURNS date AS $$
DECLARE d date := p;
BEGIN
  WHILE extract(isodow FROM d) IN (6,7)
        OR EXISTS (SELECT 1 FROM ref.court_holiday h WHERE h.holiday_date = d)
  LOOP
    d := d + 1;
  END LOOP;
  RETURN d;
END $$ LANGUAGE plpgsql STABLE;

-- TRCP 99(b): answer due "Monday next after the expiration of twenty days".
-- Must be the Monday STRICTLY AFTER the 20th day — if day 20 is itself a
-- Monday, the answer is due the FOLLOWING Monday (7 days later).
CREATE OR REPLACE FUNCTION workflow.next_monday_after(p date) RETURNS date AS $$
  SELECT p + (CASE WHEN (8 - extract(isodow FROM p)::int) % 7 = 0
              THEN 7 ELSE (8 - extract(isodow FROM p)::int) % 7 END);
$$ LANGUAGE sql IMMUTABLE;

-- Roll BACKWARD to previous business day (for backward-counted deadlines:
-- landing on a weekend must move EARLIER, never past the true deadline)
CREATE OR REPLACE FUNCTION workflow.roll_backward(p date) RETURNS date AS $$
DECLARE d date := p;
BEGIN
  WHILE extract(isodow FROM d) IN (6,7)
        OR EXISTS (SELECT 1 FROM ref.court_holiday h WHERE h.holiday_date = d)
  LOOP
    d := d - 1;
  END LOOP;
  RETURN d;
END $$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION workflow.add_business_days(p date, n int) RETURNS date AS $$
DECLARE d date := p; i int := 0; step int := sign(n)::int;
BEGIN
  WHILE i < abs(n) LOOP
    d := d + step;
    IF extract(isodow FROM d) NOT IN (6,7)
       AND NOT EXISTS (SELECT 1 FROM ref.court_holiday h WHERE h.holiday_date = d)
    THEN i := i + 1; END IF;
  END LOOP;
  RETURN d;
END $$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION workflow.compute_deadline(
  p_rule_code text, p_base_date date, p_served_by_mail boolean DEFAULT false)
RETURNS date AS $$
DECLARE r ref.deadline_rule; d date;
BEGIN
  SELECT * INTO r FROM ref.deadline_rule WHERE code = p_rule_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deadline rule %', p_rule_code; END IF;
  IF r.count_unit = 'month' THEN
    -- Gov't Code 311.014(c) anniversary method; Postgres clamps to month end
    d := (p_base_date + make_interval(months => r.day_count))::date;
  ELSIF r.count_unit = 'year' THEN
    d := (p_base_date + make_interval(years => r.day_count))::date;
  ELSIF r.count_method = 'business' THEN
    d := workflow.add_business_days(p_base_date, r.day_count);
  ELSE
    d := p_base_date + r.day_count;
  END IF;
  IF p_served_by_mail AND r.service_mail_extension THEN d := d + 3; END IF;  -- TRCP 21a
  IF r.roll_rule = 'next_monday' THEN
    d := workflow.roll_forward(workflow.next_monday_after(d));
  ELSIF r.roll_rule = 'next_business' THEN
    d := workflow.roll_forward(d);
  ELSIF r.roll_rule = 'prev_business' THEN
    d := workflow.roll_backward(d);
  END IF;
  RETURN d;
END $$ LANGUAGE plpgsql STABLE;

CREATE TABLE workflow.deadline (
  deadline_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  rule_code text REFERENCES ref.deadline_rule(code),
  label text NOT NULL,
  base_event text,                       -- 'served', 'answer filed', 'DCO'...
  base_date date,
  computed_date date,
  effective_date date NOT NULL,          -- computed_date unless manually adjusted
  adjusted_reason text,
  source text NOT NULL DEFAULT 'rule' CHECK
    (source IN ('rule','agreement','court_order','manual')),
    -- precedence: court_order > agreement > rule.  When a scheduling order
    -- covers an event, the rule-based deadline should be superseded (below).
  scheduling_order_id uuid,              -- FK added after litigation schema
  superseded_by uuid REFERENCES workflow.deadline(deadline_id),
  jurisdictional boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK
    (status IN ('pending','satisfied','missed','extended','vacated','n_a')),
  satisfied_at date,
  owner_staff_id uuid REFERENCES core.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deadline_horizon ON workflow.deadline (effective_date)
  WHERE status = 'pending';
CREATE INDEX idx_deadline_matter ON workflow.deadline (client_matter_id);

-- ============================================================================
-- WORKFLOW: DOCUMENTS  (metadata + status; bytes live in Dropbox/CasePeer)
-- ============================================================================
CREATE TABLE workflow.document (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  doc_type_code text NOT NULL REFERENCES ref.document_type(code),
  title text NOT NULL,
  direction text CHECK (direction IN ('inbound','outbound','internal')),
  status text NOT NULL DEFAULT 'needed' CHECK (status IN
    ('needed','requested','drafted','sent','received','executed','filed','problem','n_a')),
  requested_date date, sent_date date, received_date date, executed_date date,
  follow_up_due date,
  dropbox_path text,
  casepeer_doc_id text,
  bates_prefix text, bates_start text, bates_end text,
  page_count int,
  hash_sha256 text,                      -- optional integrity check
  owner_staff_id uuid REFERENCES core.staff(staff_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_document_matter ON workflow.document (client_matter_id);
CREATE INDEX idx_document_followup ON workflow.document (follow_up_due)
  WHERE status IN ('needed','requested','sent') AND deleted_at IS NULL;

ALTER TABLE core.representation_link
  ADD CONSTRAINT fk_waiver_doc FOREIGN KEY (waiver_document_id)
  REFERENCES workflow.document(document_id);

-- Signature automation (function defined in core section above)
CREATE TRIGGER trg_contract_executed
  AFTER INSERT OR UPDATE OF status ON workflow.document
  FOR EACH ROW EXECUTE FUNCTION core.on_contract_executed();

-- ============================================================================
-- WORKFLOW: NOTES  (scope-controlled; conflict block enforced by trigger)
-- ============================================================================
CREATE TABLE workflow.note (
  note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  author_staff_id uuid REFERENCES core.staff(staff_id),
  note_type text NOT NULL DEFAULT 'general',
  scope text NOT NULL DEFAULT 'single' CHECK
    (scope IN ('single','selected_linked','all_linked','incident_group')),
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_note_entity ON workflow.note (entity_id) WHERE deleted_at IS NULL;

-- Cross-matter note propagation targets (which linked matters got a copy)
CREATE TABLE workflow.note_target (
  note_id uuid NOT NULL REFERENCES workflow.note(note_id) ON DELETE CASCADE,
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, client_matter_id)
);

-- Conflict block: cannot propagate a note to a linked matter unless the
-- pairwise representation_link allows copy sharing.
CREATE OR REPLACE FUNCTION workflow.enforce_note_copy_block() RETURNS trigger AS $$
DECLARE v_src uuid;
BEGIN
  SELECT n.entity_id INTO v_src FROM workflow.note n WHERE n.note_id = NEW.note_id;
  -- if the note's home entity is a client_matter, check the pairwise link
  IF EXISTS (SELECT 1 FROM core.entity e
              WHERE e.entity_id = v_src AND e.entity_type = 'client_matter')
     AND v_src <> NEW.client_matter_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM core.representation_link rl
      WHERE ((rl.matter_a = v_src AND rl.matter_b = NEW.client_matter_id)
          OR (rl.matter_b = v_src AND rl.matter_a = NEW.client_matter_id))
        AND rl.copy_sharing_allowed
        AND rl.conflict_status IN ('cleared','waived_in_writing'))
    THEN
      RAISE EXCEPTION 'copy blocked: conflict clearance incomplete between matters % and %',
        v_src, NEW.client_matter_id;
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_note_copy_block
  BEFORE INSERT ON workflow.note_target
  FOR EACH ROW EXECUTE FUNCTION workflow.enforce_note_copy_block();

-- ============================================================================
-- WORKFLOW: COMMUNICATION LOG  (feeds "no recent client contact" red flag)
-- ============================================================================
CREATE TABLE workflow.communication_log (
  communication_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  intake_lead_id uuid REFERENCES core.intake_lead(intake_lead_id),
  person_id uuid REFERENCES core.person(person_id),      -- who we talked to
  organization_id uuid REFERENCES core.organization(organization_id),
  staff_id uuid REFERENCES core.staff(staff_id),
  channel text NOT NULL CHECK (channel IN
    ('call','sms','email','letter','fax','in_person','portal','voicemail')),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  insurance_claim_id uuid,               -- FK added after insurance schema
    -- adjuster calls bind to the specific claim (click-to-call from the
    -- claim card sets matter + claim + adjuster in one shot)
  call_status text CHECK (call_status IN
    ('initiated','connected','completed','missed','voicemail','failed')
    OR call_status IS NULL),
    -- RingOut lifecycle: row created at click time as 'initiated' with the
    -- matter context; the webhook completes it with duration + status
  occurred_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds int,
  summary text,
  ringcentral_id text,                   -- external correlation keys
  gmail_message_id text,
  plaud_recording_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_attached_to_something CHECK
    (num_nonnulls(client_matter_id, intake_lead_id, person_id, organization_id) >= 1)
);
CREATE INDEX idx_comm_matter_time ON workflow.communication_log
  (client_matter_id, occurred_at DESC);

-- ============================================================================
-- WORKFLOW: DECISION LOG  (business decisions; audit.change_log is row-level)
-- ============================================================================
CREATE TABLE workflow.decision_log (
  decision_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  decision_type text NOT NULL,           -- level_approval, conflict_clearance,
                                         -- accept, reject, file_suit, settle_authority...
  decided_by uuid NOT NULL REFERENCES core.staff(staff_id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  prior_value text,
  new_value text,
  reason text
);
CREATE INDEX idx_decision_entity ON workflow.decision_log (entity_id);

-- ============================================================================
-- WORKFLOW: 7-DAY VIABILITY REVIEW
-- ============================================================================
CREATE TABLE workflow.viability_review (
  viability_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  due_date date NOT NULL,
  prep_status text NOT NULL DEFAULT 'pending' CHECK
    (prep_status IN ('pending','in_progress','prepared')),
  prepared_by uuid REFERENCES core.staff(staff_id),
  prepared_at timestamptz,
  issue_summary text,
  missing_information text,
  cm_recommendation text CHECK (cm_recommendation IN
    ('accept','accept_with_conditions','needs_more_info','reject')),
  cm_recommended_level smallint CHECK (cm_recommended_level BETWEEN 0 AND 3),
  cm_rationale text,
  reviewer_id uuid REFERENCES core.staff(staff_id),
  reviewed_at timestamptz,
  reviewer_decision text CHECK (reviewer_decision IN
    ('accept','accept_with_conditions','needs_more_info','reject')),
  conditions text,
  instructions text,
  re_review_date date,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_viability_due ON workflow.viability_review (due_date)
  WHERE reviewed_at IS NULL;

-- ============================================================================
-- WORKFLOW: DOCUMENT & EMAIL TEMPLATES  (LORs, LOPs, records requests,
-- disbursement sheets, standard emails — "facts entered once, documents
-- generated from fields")
--
-- Three layers:
--   template            what exists: a versioned .docx/.xlsx file (path in
--                       Dropbox) or an inline email/SMS body with {{tokens}}
--   merge_field         the dictionary: every {{token}} and where its value
--                       comes from in this schema
--   generated_document  the log: each instance actually generated — template
--                       version used, the EXACT merge values as a snapshot,
--                       the resulting tracked document, and email delivery
-- ============================================================================
CREATE TABLE workflow.template (
  template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,                    -- 'lor_liability', 'email_adjuster_callback'
  version int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  name text NOT NULL,
  description text,
  output_kind text NOT NULL CHECK (output_kind IN
    ('docx','xlsx','pdf','email','sms')),
  produces_doc_type text REFERENCES ref.document_type(code),
  file_path text,                        -- Dropbox path to the .docx/.xlsx master
                                         -- (NULL until the template is provided)
  email_subject_template text,           -- email/sms only, {{tokens}} allowed
  body_template text,                    -- email/sms body with {{tokens}}
  default_recipient_role text,           -- 'adjuster','mediator','provider_records',
                                         -- 'opposing_counsel','client','lienholder'
  suggested_stage text REFERENCES ref.matter_stage(code),
  trigger_event text,                    -- 'contract_signed','treatment_complete',
                                         -- 'settlement_agreed'... app creates a
                                         -- "generate this" task on the event
  requires_attorney_review boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES core.staff(staff_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_code_version UNIQUE (code, version)
);
-- exactly one current version per template code
CREATE UNIQUE INDEX uq_template_current ON workflow.template (code)
  WHERE is_current AND active;

-- Merge-field dictionary: single source of truth for {{token}} → data mapping.
-- source_hint documents where the value lives; the app layer resolves it.
CREATE TABLE workflow.merge_field (
  code text PRIMARY KEY,                 -- token WITHOUT braces: 'client_full_name'
  label text NOT NULL,
  source_hint text NOT NULL,             -- schema path / expression that supplies it
  pii boolean NOT NULL DEFAULT false,    -- flag SSN/DOB-class fields
  notes text
);

-- Which fields a template uses (populated as each template is built)
CREATE TABLE workflow.template_merge_field (
  template_id uuid NOT NULL REFERENCES workflow.template(template_id) ON DELETE CASCADE,
  merge_field_code text NOT NULL REFERENCES workflow.merge_field(code),
  required boolean NOT NULL DEFAULT true,
  fallback_text text,                    -- used when optional field is empty
  PRIMARY KEY (template_id, merge_field_code)
);

-- Every generated instance: audit trail of what went out, built from what.
CREATE TABLE workflow.generated_document (
  generated_document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workflow.template(template_id),
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  context_entity_id uuid REFERENCES core.entity(entity_id),
    -- the object it was generated ABOUT: a claim (LOR), treatment episode
    -- (LOP/records request), mediation (availability email), settlement
    -- (disbursement sheet)
  document_id uuid REFERENCES workflow.document(document_id),
    -- resulting file, tracked like every other document (status, follow-ups)
  merge_data jsonb NOT NULL,             -- exact token values used — frozen
  missing_fields text[],                 -- tokens unresolved at generation
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','pending_review','approved','sent','failed','void')),
  channel text CHECK (channel IN ('file','gmail','outlook','print_mail','fax')
                      OR channel IS NULL),
  recipient_name text, recipient_email citext,
  sent_at timestamptz,
  external_message_id text,              -- Gmail/Outlook message id for threading
  generated_by uuid REFERENCES core.staff(staff_id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES core.staff(staff_id),
  reviewed_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gendoc_matter ON workflow.generated_document (client_matter_id);
CREATE INDEX idx_gendoc_pending ON workflow.generated_document (status)
  WHERE status IN ('draft','pending_review');

-- ============================================================================
-- WORKFLOW: SEMANTIC SEARCH EMBEDDINGS
-- One row per chunk of embeddable text (notes, emails, document extracts,
-- depo summaries), keyed to the entity registry so results link straight
-- back to the matter/defendant/lien the text belongs to.
-- The app layer generates embeddings via the embedding API on insert/update
-- (content_hash lets it skip unchanged text). Query pattern:
--   SELECT entity_id, chunk_text FROM workflow.embedding
--   ORDER BY embedding <=> $query_vector LIMIT 20;
-- Vector dimension MUST match the chosen embedding model (1024 = voyage-3;
-- change once, before loading data, if you pick a different model).
-- ============================================================================
CREATE TABLE workflow.embedding (
  embedding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES core.entity(entity_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN
    ('note','communication','document_text','depo_summary','production_finding','other')),
  chunk_no int NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  content_hash text NOT NULL,            -- sha256 of chunk_text; skip re-embedding
  embedding vector(1024) NOT NULL,
  model text NOT NULL,                   -- e.g. 'voyage-3'
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_embedding_chunk UNIQUE (entity_id, source_kind, chunk_no)
);
CREATE INDEX idx_embedding_matter ON workflow.embedding (client_matter_id);
-- ANN index: create AFTER bulk-loading embeddings (build is faster that way):
--   CREATE INDEX idx_embedding_hnsw ON workflow.embedding
--     USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- INSURANCE: POLICIES, CLAIMS, COVERAGE ASSESSMENT
-- ============================================================================
CREATE TABLE insurance.policy (
  policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_org_id uuid NOT NULL REFERENCES core.organization(organization_id),
  policy_number text,
  policy_type text NOT NULL CHECK (policy_type IN
    ('auto_liability','commercial_auto','umbrella_excess','homeowners','cgl',
     'pip','um_uim','medpay','workers_comp','professional','health','other')),
    -- 'health' = client's own health plan; identity matters for lien screening
    -- (Medicare Advantage vs ERISA self-funded vs fully insured changes leverage)
  holder_person_id uuid REFERENCES core.person(person_id),
  holder_org_id uuid REFERENCES core.organization(organization_id),
  per_person_limit numeric(14,2),
  per_occurrence_limit numeric(14,2),
  aggregate_limit numeric(14,2),
  pip_amount numeric(14,2),
  um_uim_amount numeric(14,2),
  medpay_amount numeric(14,2),
  um_uim_rejection_docs_received boolean,
  effective_date date, expiration_date date,
  dec_sheet_requested date, dec_sheet_received date,
  limits_verified boolean NOT NULL DEFAULT false,
  limits_verified_how text,              -- dec sheet, carrier letter, discovery...
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_policy_carrier ON insurance.policy (carrier_org_id);

-- A claim opened under a policy.  Attaches to incident (shared liability
-- claim) or to a single matter (client's own PIP/UM claim) — exclusive arc.
CREATE TABLE insurance.claim (
  claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES insurance.policy(policy_id),
  incident_group_id uuid REFERENCES core.incident_group(incident_group_id) ON DELETE CASCADE,
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  claim_role text NOT NULL CHECK (claim_role IN
    ('dinsco_liability','pinsco_liability','pip','um_uim','medpay',
     'pd_dinsco','pd_pinsco','workers_comp','umbrella','other')),
  claim_number text,
  adjuster_person_id uuid REFERENCES core.person(person_id),
    -- nullable by design: some claims are worked by a UNIT, not a person
  adjuster_phone text,
  adjuster_extension text,               -- carrier main number + this extension
  adjuster_email citext,
  handling_unit text,                    -- "Claims Team 5", "Litigation Unit B" —
                                         -- the group working the claim when no
                                         -- (or not only a) named adjuster exists
  date_reported date,
  lor_sent date,                         -- letter of representation
  status text NOT NULL DEFAULT 'open' CHECK (status IN
    ('open','liability_accepted','liability_disputed','liability_denied',
     'settled','closed','litigation')),
  liability_acceptance_pct int CHECK (liability_acceptance_pct BETWEEN 0 AND 100),
  policy_limits_request_sent date,       -- pre-suit limits request (contractual /
                                         -- negotiated; TX has no general statutory
                                         -- third-party pre-suit disclosure duty)
  policy_limits_disclosed date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT claim_scope_arc CHECK (num_nonnulls(incident_group_id, client_matter_id) = 1)
);
CREATE INDEX idx_claim_incident ON insurance.claim (incident_group_id);
CREATE INDEX idx_claim_matter ON insurance.claim (client_matter_id);

ALTER TABLE workflow.communication_log
  ADD CONSTRAINT fk_comm_claim FOREIGN KEY (insurance_claim_id)
  REFERENCES insurance.claim(claim_id);

-- Inbound triage queue: communications that matched a person/org but could
-- not be auto-attributed to a single matter (client with multiple open
-- matters; adjuster or provider main line). One-click assignment in the UI.
CREATE OR REPLACE VIEW workflow.v_comms_needing_matter AS
SELECT cl.communication_log_id, cl.channel, cl.direction, cl.occurred_at,
       cl.duration_seconds, cl.summary,
       p.first_name || ' ' || p.last_name AS person_name,
       o.name AS org_name,
       (SELECT count(*) FROM core.client_matter m
         WHERE m.client_person_id = cl.person_id
           AND m.deleted_at IS NULL
           AND m.representation_status = 'active') AS candidate_matters
FROM workflow.communication_log cl
LEFT JOIN core.person p ON p.person_id = cl.person_id
LEFT JOIN core.organization o ON o.organization_id = cl.organization_id
WHERE cl.client_matter_id IS NULL
  AND cl.intake_lead_id IS NULL
ORDER BY cl.occurred_at DESC;

-- Per-matter coverage analysis: the Level inputs, in one row per matter.
CREATE TABLE insurance.coverage_assessment (
  coverage_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL UNIQUE
    REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  dinsco_status text NOT NULL DEFAULT 'unknown' CHECK
    (dinsco_status IN ('yes','no','unknown')),
  dinsco_confirmed_limits numeric(14,2),
  above_minimum_evidence boolean,
  above_minimum_reason text CHECK (above_minimum_reason IN
    ('company_vehicle','rideshare','high_value_vehicle','high_value_home',
     'umbrella_indicators','commercial','other') OR above_minimum_reason IS NULL),
  above_minimum_explanation text,
  pinsco_exists boolean,
  pinsco_permission_to_use boolean,
  pinsco_permission_note text,
  commercial_policy_possible boolean NOT NULL DEFAULT false,
  employer_course_scope boolean,
  umbrella_excess_possible boolean NOT NULL DEFAULT false,
  coverage_search_complete boolean NOT NULL DEFAULT false,
  coverage_followup_owner uuid REFERENCES core.staff(staff_id),
  coverage_followup_due date,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- MEDICAL: PROVIDERS, TREATMENT, RECORDS, BILLS, 18.001
-- ============================================================================
CREATE TABLE medical.provider (
  provider_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES core.organization(organization_id),
  provider_type text NOT NULL CHECK (provider_type IN
    ('hospital','emergency','urgent_care','pain_management','chiropractic',
     'orthopedic','neurology','imaging','physical_therapy','surgery_center',
     'primary_care','mental_health','pharmacy','ems','other')),
  accepts_lop boolean,
  records_request_method text,           -- portal, fax, Datavant/Ciox, mail
  records_vendor_org_id uuid REFERENCES core.organization(organization_id),
  records_contact_notes text,
  billing_contact_notes text,
  typical_reduction_pct numeric(5,2),    -- institutional knowledge over time
  quality_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One client's course of care at one provider
CREATE TABLE medical.treatment_episode (
  treatment_episode_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES medical.provider(provider_id),
  referred_by text,
  is_primary_pm boolean NOT NULL DEFAULT false,   -- the PONS/pain-mgmt anchor
  under_lop boolean NOT NULL DEFAULT false,
  first_visit date, last_visit date,
  projected_completion date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN
    ('scheduled','active','gap_concern','noncompliant','completed',
     'cut_off','discharged','never_treated')),
  approx_balance numeric(14,2),
  balance_as_of date,
  visit_count int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_episode_matter ON medical.treatment_episode (client_matter_id);
CREATE INDEX idx_episode_provider ON medical.treatment_episode (provider_id);

-- Bi-weekly provider contact log.  Insert trigger auto-schedules the next
-- call task 14 days out while the episode is active (one-tap logging).
CREATE TABLE medical.provider_contact_log (
  provider_contact_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_episode_id uuid NOT NULL
    REFERENCES medical.treatment_episode(treatment_episode_id) ON DELETE CASCADE,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  contacted_by uuid REFERENCES core.staff(staff_id),
  method text NOT NULL DEFAULT 'phone' CHECK
    (method IN ('phone','portal','fax','email','in_person')),
  reached boolean NOT NULL DEFAULT true,
  treatment_confirmed boolean,
  approx_balance numeric(14,2),
  next_appointment date,
  gap_or_compliance_concern boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION medical.schedule_next_provider_call() RETURNS trigger AS $$
DECLARE v_matter uuid; v_status text; v_owner uuid;
BEGIN
  SELECT te.client_matter_id, te.status INTO v_matter, v_status
    FROM medical.treatment_episode te
   WHERE te.treatment_episode_id = NEW.treatment_episode_id;
  -- update the episode's rolling balance snapshot
  UPDATE medical.treatment_episode
     SET approx_balance = coalesce(NEW.approx_balance, approx_balance),
         balance_as_of  = CASE WHEN NEW.approx_balance IS NOT NULL
                               THEN NEW.contacted_at::date ELSE balance_as_of END
   WHERE treatment_episode_id = NEW.treatment_episode_id;
  IF v_status IN ('scheduled','active','gap_concern') THEN
    SELECT sa.staff_id INTO v_owner
      FROM core.staff_assignment sa
     WHERE sa.client_matter_id = v_matter
       AND sa.assignment_role = 'case_manager' AND sa.ended_at IS NULL
     LIMIT 1;
    INSERT INTO workflow.task (entity_id, client_matter_id, task_type, title,
                               owner_staff_id, due_date, trigger_source,
                               recurring_interval)
    VALUES (v_matter, v_matter, 'provider_call',
            'Bi-weekly provider treatment/balance check',
            v_owner, (NEW.contacted_at::date + 14), 'provider_contact_log',
            interval '14 days');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_next_provider_call
  AFTER INSERT ON medical.provider_contact_log
  FOR EACH ROW EXECUTE FUNCTION medical.schedule_next_provider_call();

-- Injuries claimed
CREATE TABLE medical.injury (
  injury_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  body_part text NOT NULL,
  description text,
  is_tbi boolean NOT NULL DEFAULT false, -- traumatic brain injury: major value
                                         -- signal, tracked per injury
  icd10_code text,
  pre_existing_same_part boolean NOT NULL DEFAULT false,
  prior_claim_same_part boolean NOT NULL DEFAULT false,
  initial_pain_level smallint CHECK (initial_pain_level BETWEEN 0 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Clinical milestones that drive value & referral-up decisions
CREATE TABLE medical.clinical_event (
  clinical_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  treatment_episode_id uuid REFERENCES medical.treatment_episode(treatment_episode_id),
  event_type_code text NOT NULL REFERENCES ref.clinical_event_type(code),
  event_date date,
  recommended boolean NOT NULL DEFAULT false,   -- recommended vs completed
  completed boolean NOT NULL DEFAULT false,
  body_region text CHECK (body_region IN
    ('lumbar','cervical','thoracic','shoulder','knee','other') OR body_region IS NULL),
    -- ESIs / MBBs / RFAs are tracked per region (lumbar, cervical, shoulder,
    -- knee, other); one row per region when multiple
  referred_to_org_id uuid REFERENCES core.organization(organization_id),
  referred_to_text text,                 -- "MRI referral ... and to where"
  reported_in_call_id uuid REFERENCES medical.provider_contact_log(provider_contact_log_id),
    -- ties the event to the PM call that reported it (the call-logger checkboxes)
  cpt_code text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinical_matter ON medical.clinical_event (client_matter_id);

-- Records / bills / affidavit requests to providers
CREATE TABLE medical.record_request (
  record_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_episode_id uuid NOT NULL
    REFERENCES medical.treatment_episode(treatment_episode_id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN
    ('records','bills','records_and_bills','affidavit_18001','radiology_films')),
  date_range_from date, date_range_to date,
  sent_date date, method text, vendor_reference text,
  received_date date, page_count int,
  invoice_amount numeric(14,2),
  case_expense_id uuid,                  -- FK added after finance schema
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','sent','partial','received','problem','cancelled')),
  follow_up_due date,
  hipaa_verified boolean NOT NULL DEFAULT false,  -- auth on file before sending
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recreq_followup ON medical.record_request (follow_up_due)
  WHERE status IN ('sent','partial','problem');

-- Billing per provider (feeds damages model, 18.001, and lien math)
CREATE TABLE medical.bill (
  bill_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_episode_id uuid NOT NULL
    REFERENCES medical.treatment_episode(treatment_episode_id) ON DELETE CASCADE,
  total_billed numeric(14,2) NOT NULL DEFAULT 0,
  adjustments numeric(14,2) NOT NULL DEFAULT 0,
  paid_health_insurance numeric(14,2) NOT NULL DEFAULT 0,
  paid_pip numeric(14,2) NOT NULL DEFAULT 0,
  paid_medpay numeric(14,2) NOT NULL DEFAULT 0,
  paid_client numeric(14,2) NOT NULL DEFAULT 0,
  outstanding_balance numeric(14,2),
  verified_date date,
  paid_or_incurred_note text,            -- CPRC 41.0105 posture
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CPRC 18.001 affidavits & counter-affidavit tracking
CREATE TABLE medical.affidavit_18001 (
  affidavit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  treatment_episode_id uuid REFERENCES medical.treatment_episode(treatment_episode_id),
  affidavit_type text NOT NULL CHECK
    (affidavit_type IN ('records_custodian','billing_reasonableness')),
  executed_date date, amount_covered numeric(14,2),
  served_date date,
  service_deadline date,                 -- computed off trial/DCO per current 18.001
  counter_affidavit_received date,
  counter_deadline date,
  controverting_expert text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','executed','served','controverted','unchallenged','struck')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lost wages / employment impact
CREATE TABLE medical.wage_loss (
  wage_loss_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL UNIQUE
    REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  employment_status text CHECK (employment_status IN
    ('employed_w2','employed_1099','self_employed','unemployed','retired','student','other')),
  employer_org_id uuid REFERENCES core.organization(organization_id),
  missed_work_from date, missed_work_to date,
  hourly_rate numeric(10,2), weekly_wage numeric(12,2),
  total_claimed numeric(14,2),
  work_restrictions text,
  employer_verification_doc uuid REFERENCES workflow.document(document_id),
  loss_of_earning_capacity boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- WORKFLOW: PUBLIC RECORDS REQUESTS (federal FOIA / Texas PIA)
-- Crash reports, 911 audio, bodycam, TxDOT, agency investigation files.
-- Both statutes carry response clocks (seeded in ref.deadline_rule); TPIA
-- withholding runs through the AG (Gov't Code 552.301) — tracked here.
-- ============================================================================
CREATE TABLE workflow.public_records_request (
  public_records_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  incident_group_id uuid REFERENCES core.incident_group(incident_group_id) ON DELETE CASCADE,
  statute text NOT NULL CHECK (statute IN ('foia','tx_pia','tx_dps_driver_record')),
    -- tx_dps_driver_record: adverse driver's record from TX DPS (Transp. Code
    -- 521.049-.050; DPPA/ch. 730 permissible-use — litigation/anticipation)
  agency_org_id uuid REFERENCES core.organization(organization_id),
  agency_name text,                      -- until/unless an org record exists
  subject_person_id uuid REFERENCES core.person(person_id),
    -- whose record (e.g., the adverse driver for a DPS driving record)
  records_description text NOT NULL,     -- what was asked for
  date_range_from date, date_range_to date,
  sent_date date, method text,           -- portal, email, certified mail
  response_due date,                     -- compute: foia_response_20bd / tpia_response_10bd
  acknowledged_date date,
  response_received date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','sent','acknowledged','partial','fulfilled','denied',
     'ag_referral','appealed','withdrawn')),
  -- TPIA withholding path / FOIA appeal path
  ag_referral_date date,                 -- agency sought AG ruling (TPIA 552.301)
  ag_ruling_date date, ag_ruling_summary text,
  appeal_filed_date date,
  fee_quoted numeric(12,2), fee_paid numeric(12,2),
  case_expense_id uuid,                  -- FK added after finance schema
  generated_document_id uuid REFERENCES workflow.generated_document(generated_document_id),
  response_document_id uuid REFERENCES workflow.document(document_id),
  follow_up_due date,
  owner_staff_id uuid REFERENCES core.staff(staff_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prr_scope CHECK (num_nonnulls(client_matter_id, incident_group_id) >= 1)
);
CREATE INDEX idx_prr_followup ON workflow.public_records_request (follow_up_due)
  WHERE status IN ('sent','acknowledged','partial','ag_referral');

-- ============================================================================
-- PROPERTY DAMAGE
-- ============================================================================
CREATE TABLE property.vehicle (
  vehicle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_group_id uuid NOT NULL
    REFERENCES core.incident_group(incident_group_id) ON DELETE CASCADE,
  year int, make text, model text, vin text,
  owner_person_id uuid REFERENCES core.person(person_id),
  owner_org_id uuid REFERENCES core.organization(organization_id),
  lienholder_org_id uuid REFERENCES core.organization(organization_id),
  is_client_vehicle boolean NOT NULL DEFAULT true,
  drivable boolean, current_location text,
  storage_accruing boolean NOT NULL DEFAULT false,
  photos_received boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_incident ON property.vehicle (incident_group_id);

CREATE TABLE property.pd_claim (
  pd_claim_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES property.vehicle(vehicle_id) ON DELETE CASCADE,
  insurance_claim_id uuid REFERENCES insurance.claim(claim_id),
  status text NOT NULL DEFAULT 'not_started' CHECK
    (status IN ('not_started','in_progress','resolved','n_a')),
  owner_staff_id uuid REFERENCES core.staff(staff_id),
  opened_date date, last_touch_date date,
  repairable_or_total text CHECK (repairable_or_total IN ('repairable','total_loss','undetermined')),
  estimate_amount numeric(14,2),
  valuation_received boolean NOT NULL DEFAULT false,
  valuation_amount numeric(14,2),
  valuation_reviewed boolean NOT NULL DEFAULT false,
  valuation_disputed boolean NOT NULL DEFAULT false,
  payoff_amount numeric(14,2),
  lienholder_resolved boolean,
  title_paperwork_status text,
  deductible numeric(10,2),
  deductible_reimbursed boolean,
  rental_status text CHECK (rental_status IN
    ('not_needed','requested','active','ended','denied') OR rental_status IS NULL),
  loss_of_use_pursued boolean NOT NULL DEFAULT false,
  loss_of_use_amount numeric(12,2),
  diminished_value_evaluated boolean NOT NULL DEFAULT false,
  diminished_value_amount numeric(12,2),
  property_contents_claimed boolean NOT NULL DEFAULT false,
  demand_blocker boolean NOT NULL DEFAULT false,
  resolved_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LIENS & SUBROGATION
-- ============================================================================
-- Early lien/subro SCREEN (planning doc §11) — one row per matter, completed
-- during the 7-day review.  Answers "did we look?", not "is there a lien?";
-- confirmed liens become liens.lien rows.
CREATE TABLE liens.lien_screen (
  client_matter_id uuid PRIMARY KEY
    REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  oag_search_run boolean NOT NULL DEFAULT false,
  oag_search_date date,
  oag_result text,                       -- none found / lien found / pending
  medicare_beneficiary text NOT NULL DEFAULT 'unknown' CHECK
    (medicare_beneficiary IN ('yes','no','unknown')),
  medicaid_recipient text NOT NULL DEFAULT 'unknown' CHECK
    (medicaid_recipient IN ('yes','no','unknown')),
  private_health_used boolean,
  erisa_possible boolean,
  hospital_lien_possible boolean,
  hospital_lien_county_checked boolean,  -- Prop. Code 55: filed in county records
  va_tricare boolean,
  workers_comp_paid boolean,
  prior_attorney boolean,
  screened_by uuid REFERENCES core.staff(staff_id),
  screened_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE liens.lien (
  lien_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  lien_type_code text NOT NULL REFERENCES ref.lien_type(code),
  holder_org_id uuid REFERENCES core.organization(organization_id),
  treatment_episode_id uuid REFERENCES medical.treatment_episode(treatment_episode_id),
  status text NOT NULL DEFAULT 'possible' CHECK (status IN
    ('possible','confirmed','verified','negotiating','resolved','waived',
     'disputed','not_applicable')),
  asserted_amount numeric(14,2),
  verified_amount numeric(14,2),
  negotiated_amount numeric(14,2),
  final_amount numeric(14,2),
  reduction_pct numeric(5,2),
  flagged_for_resolution_date date,      -- CM flags → Emily's worklist
  owner_staff_id uuid REFERENCES core.staff(staff_id),
  resolution_date date,
  statutory_basis text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_lien_matter ON liens.lien (client_matter_id);
CREATE INDEX idx_lien_open ON liens.lien (owner_staff_id)
  WHERE status NOT IN ('resolved','waived','not_applicable');

-- Medicare-specific compliance detail (MSPRC/BCRC workflow)
CREATE TABLE liens.medicare_detail (
  lien_id uuid PRIMARY KEY REFERENCES liens.lien(lien_id) ON DELETE CASCADE,
  bcrc_reported_date date,
  rights_and_responsibilities_received date,
  conditional_payment_letter_date date,
  conditional_payment_amount numeric(14,2),
  final_demand_date date,
  final_demand_amount numeric(14,2),
  waiver_or_compromise_requested boolean NOT NULL DEFAULT false,
  msp_portal_case_id text,
  medicare_advantage_plan text,          -- Part C plans assert separately
  notes text
);

CREATE TABLE liens.lien_event (
  lien_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lien_id uuid NOT NULL REFERENCES liens.lien(lien_id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  action text NOT NULL,                  -- verified, offer sent, reduction agreed...
  amount numeric(14,2),
  by_staff_id uuid REFERENCES core.staff(staff_id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- RESOLUTION: DEMANDS, NEGOTIATION, SETTLEMENT
-- ============================================================================
CREATE TABLE resolution.demand (
  demand_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  insurance_claim_id uuid REFERENCES insurance.claim(claim_id),
  demand_type text NOT NULL DEFAULT 'standard' CHECK (demand_type IN
    ('standard','stowers_time_limited','policy_limits','um_uim','excess_letter')),
  amount numeric(14,2),
  is_within_limits boolean,
  -- Stowers predicate tracking
  stowers_liability_reasonably_clear boolean,
  stowers_unconditional boolean,
  stowers_reasonable_opportunity_days int,
  drafted_by uuid REFERENCES core.staff(staff_id),
  reviewed_by uuid REFERENCES core.staff(staff_id),        -- Kate
  reviewed_at timestamptz,
  attorney_approved_by uuid REFERENCES core.staff(staff_id), -- required Level 3
  attorney_approved_at timestamptz,
  sent_date date, delivery_method text,
  delivery_confirmed boolean NOT NULL DEFAULT false,
  response_due date,
  response_received date,
  response_type text CHECK (response_type IN
    ('accepted','counter','denied','request_more_info','no_response','tender_limits')
    OR response_type IS NULL),
  response_amount numeric(14,2),
  document_id uuid REFERENCES workflow.document(document_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_demand_matter ON resolution.demand (client_matter_id);
CREATE INDEX idx_demand_response_due ON resolution.demand (response_due)
  WHERE response_received IS NULL AND sent_date IS NOT NULL;

CREATE TABLE resolution.negotiation_event (
  negotiation_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  demand_id uuid REFERENCES resolution.demand(demand_id),
  insurance_claim_id uuid REFERENCES insurance.claim(claim_id),
    -- which carrier/claim this round is with (multi-defendant: GEICO thread
    -- vs. commercial-carrier thread vs. UIM thread are separate histories)
  lit_party_id uuid,                     -- which DEFENDANT, once suit is filed
                                         -- (FK added after litigation schema)
  event_type text NOT NULL CHECK (event_type IN
    ('offer','counter_demand','counter_offer','client_authority_obtained',
     'mediation_offer','rule_167_offer','high_low_agreement','impasse','acceptance')),
  amount numeric(14,2),
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  by_side text NOT NULL CHECK (by_side IN ('plaintiff','defense','client','mediator')),
  logged_by uuid REFERENCES core.staff(staff_id),
  adjuster_or_counsel text,
  client_consent_documented boolean,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_negotiation_matter ON resolution.negotiation_event (client_matter_id);

CREATE TABLE resolution.settlement (
  settlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  insurance_claim_id uuid REFERENCES insurance.claim(claim_id),
  lit_party_id uuid,                     -- settling DEFENDANT when in suit
                                         -- (FK added after litigation schema);
                                         -- multiple settlement rows per matter
                                         -- = settle A, keep litigating B
  settles_all_defendants boolean,        -- global vs. partial resolution
  gross_amount numeric(14,2) NOT NULL,
  agreed_date date NOT NULL,
  settled_stage text NOT NULL CHECK (settled_stage IN
    ('pre_suit','post_filing','post_discovery','mediation','trial','appeal')),
  payor text,
  -- minor / incapacitated settlement controls
  court_approval_required boolean NOT NULL DEFAULT false,
  friendly_suit_cause_no text,
  guardian_ad_litem_person_id uuid REFERENCES core.person(person_id),
  court_approval_date date,
  structured_settlement boolean NOT NULL DEFAULT false,
  funds_received_date date,
  check_cleared_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resolution.settlement_release (
  settlement_release_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES resolution.settlement(settlement_id) ON DELETE CASCADE,
  release_type text NOT NULL DEFAULT 'full' CHECK (release_type IN
    ('full','partial','indemnity_heavy','confidential','high_low')),
  received_date date, reviewed_date date, executed_date date, returned_date date,
  indemnity_language_concern boolean NOT NULL DEFAULT false,
  confidentiality_clause boolean NOT NULL DEFAULT false,
  medicare_language boolean NOT NULL DEFAULT false,
  document_id uuid REFERENCES workflow.document(document_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LITIGATION: THE SUIT  (a matter can have >1 filed case: refile, intervention)
-- ============================================================================
CREATE TABLE litigation.court_case (
  court_case_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  court_id uuid REFERENCES ref.court(court_id),
  cause_number text,
  style text,
  jurisdiction text NOT NULL DEFAULT 'state' CHECK (jurisdiction IN ('state','federal')),
  case_kind text NOT NULL DEFAULT 'merits' CHECK (case_kind IN
    ('merits','rule_202_presuit_depo','friendly_suit','interpleader','other')),
    -- rule_202: pre-suit investigative depo petition; friendly_suit: minor
    -- settlement approval — both are real dockets that aren't the injury suit
  filed_date date,
  our_role text NOT NULL DEFAULT 'plaintiff' CHECK
    (our_role IN ('plaintiff','intervenor','counter_plaintiff')),
  -- TRCP 190 discovery plan
  discovery_level smallint CHECK (discovery_level IN (1,2,3)),
  discovery_period_start date,
  discovery_period_end date,
  dco_signed_date date,                  -- docket control / scheduling order
  dco_document_id uuid REFERENCES workflow.document(document_id),
  jury_demanded boolean NOT NULL DEFAULT true,
  jury_fee_paid_date date,
  -- removal / remand (federal practice)
  removed_date date,
  removal_basis text,
  remand_motion_filed date,
  remand_ruling text CHECK (remand_ruling IN ('granted','denied','pending') OR remand_ruling IS NULL),
  federal_case_number text,
  -- HB 19 (commercial motor vehicle bifurcation)
  hb19_applies boolean NOT NULL DEFAULT false,
  bifurcation_motion_filed date,
  bifurcation_granted boolean,
  trial_phase text CHECK (trial_phase IN ('phase_1','phase_2') OR trial_phase IS NULL),
  -- posture
  status text NOT NULL DEFAULT 'active' CHECK (status IN
    ('active','stayed','abated','mediation','trial_setting','tried',
     'judgment','appeal','nonsuited','dismissed','settled','closed')),
  efile_service_email citext,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_case_matter ON litigation.court_case (client_matter_id);

-- Parties as pleaded (defendants, co-plaintiffs, intervenors, third parties)
-- (resolution.negotiation_event / settlement FKs to this table are added
--  right after it exists — negotiations happen pre-suit AND per-defendant)
CREATE TABLE litigation.lit_party (
  lit_party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  person_id uuid REFERENCES core.person(person_id),
  organization_id uuid REFERENCES core.organization(organization_id),
  pleaded_name text NOT NULL,
  alignment text NOT NULL CHECK (alignment IN
    ('plaintiff','defendant','intervenor','third_party_defendant',
     'responsible_third_party','counter_defendant')),
  capacity text,                         -- individually, d/b/a, as employer...
  rtp_designation_date date,             -- CPRC 33.004 responsible third party
  counsel_org_id uuid REFERENCES core.organization(organization_id),
  counsel_person_id uuid REFERENCES core.person(person_id),
  answer_due date,
  answer_filed date,
  in_default boolean NOT NULL DEFAULT false,
  default_judgment_date date,
  dismissed_date date, dismissal_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT litparty_who_arc CHECK (num_nonnulls(person_id, organization_id) = 1)
);
CREATE INDEX idx_litparty_case ON litigation.lit_party (court_case_id);

ALTER TABLE resolution.negotiation_event
  ADD CONSTRAINT fk_negotiation_litparty FOREIGN KEY (lit_party_id)
  REFERENCES litigation.lit_party(lit_party_id);
ALTER TABLE resolution.settlement
  ADD CONSTRAINT fk_settlement_litparty FOREIGN KEY (lit_party_id)
  REFERENCES litigation.lit_party(lit_party_id);
CREATE INDEX idx_negotiation_litparty ON resolution.negotiation_event (lit_party_id)
  WHERE lit_party_id IS NOT NULL;

-- Service of citation, with attempt-level diligence log
-- (diligence in service = tolling; every attempt must be documented)
CREATE TABLE litigation.service_of_process (
  service_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lit_party_id uuid NOT NULL REFERENCES litigation.lit_party(lit_party_id) ON DELETE CASCADE,
  citation_requested date, citation_issued date,
  method text CHECK (method IN
    ('personal','certified_mail','rule_106_substituted','secretary_of_state',
     'commissioner_of_insurance','tx_transp_code_chair','publication','waiver','other')),
  rule_106_motion_filed date, rule_106_order_signed date,
  process_server_org_id uuid REFERENCES core.organization(organization_id),
  served_date date,
  return_filed_date date,
  service_complete boolean NOT NULL DEFAULT false,
  diligence_summary text,                -- narrative for limitations tolling
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE litigation.service_attempt (
  service_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES litigation.service_of_process(service_id) ON DELETE CASCADE,
  attempt_at timestamptz NOT NULL,
  address_attempted text,
  method text,
  result text NOT NULL,                  -- no answer, moved, evading, served...
  server_person_id uuid REFERENCES core.person(person_id),
    -- optional: known servers picked from contacts (UI dropdown);
    -- fall back to free-text server_name for one-offs
  server_name text,
  affidavit_document_id uuid REFERENCES workflow.document(document_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Filings docket (petitions, answers, motions, responses, notices, orders)
CREATE TABLE litigation.filing (
  filing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  filing_type text NOT NULL,             -- original_petition, amended_petition,
                                         -- answer, motion, response, order, notice...
  title text NOT NULL,
  filed_by_side text CHECK (filed_by_side IN ('plaintiff','defense','court','third_party')),
  filed_date date,
  efile_envelope_number text,
  document_id uuid REFERENCES workflow.document(document_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_filing_case ON litigation.filing (court_case_id, filed_date);

-- ============================================================================
-- LITIGATION: COURT-ENTERED SCHEDULING ORDERS (DCO)
-- A signed scheduling order SUPERSEDES rule-based defaults.  Enter the
-- order's dates here, then run litigation.apply_scheduling_order(): it
-- creates court_order deadlines and vacates the superseded rule-based and
-- prior-order deadlines.  Amended orders supersede earlier ones the same way.
-- ============================================================================
CREATE TABLE litigation.scheduling_order (
  scheduling_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  order_type text NOT NULL DEFAULT 'dco' CHECK
    (order_type IN ('dco','agreed_scheduling','trial_preparation','amended')),
  signed_date date NOT NULL,
  supersedes_order_id uuid REFERENCES litigation.scheduling_order(scheduling_order_id),
  document_id uuid REFERENCES workflow.document(document_id),
  -- the order's operative dates (null = order silent; rule default stands)
  pleadings_amendment_deadline date,
  expert_designation_plaintiff date,
  expert_designation_defense date,
  expert_challenge_deadline date,
  discovery_close date,
  dispositive_motion_deadline date,
  challenge_expert_deadline date,
  mediation_deadline date,
  pretrial_disclosures_due date,
  pretrial_conference_at timestamptz,
  trial_date date,
  other_deadlines_note text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_so_case ON litigation.scheduling_order (court_case_id);

ALTER TABLE workflow.deadline
  ADD CONSTRAINT fk_deadline_scheduling_order
  FOREIGN KEY (scheduling_order_id)
  REFERENCES litigation.scheduling_order(scheduling_order_id);

CREATE OR REPLACE FUNCTION litigation.apply_scheduling_order(p_order uuid)
RETURNS int AS $$
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
END $$ LANGUAGE plpgsql;

-- ============================================================================
-- LITIGATION: PER-DEFENDANT 18.001 WINDOWS
-- Under CPRC 18.001 the plaintiff's service deadline and each defendant's
-- counter-affidavit window key off THAT defendant's answer date.  One row
-- per (affidavit x defendant).  Compute dates with the aff18001_* rules
-- using the defendant's answer_filed as the base (ATTORNEY-VERIFY).
-- ============================================================================
CREATE TABLE litigation.affidavit_18001_party (
  affidavit_party_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affidavit_id uuid NOT NULL
    REFERENCES medical.affidavit_18001(affidavit_id) ON DELETE CASCADE,
  lit_party_id uuid NOT NULL
    REFERENCES litigation.lit_party(lit_party_id) ON DELETE CASCADE,
  our_service_due date,                  -- keyed to this defendant's answer
  served_on_date date,
  counter_affidavit_due date,            -- this defendant's window
  counter_affidavit_received date,
  controverting_expert text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','served','controverted','unchallenged','struck','moot')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_affidavit_party UNIQUE (affidavit_id, lit_party_id)
);
CREATE INDEX idx_aff_party_due ON litigation.affidavit_18001_party
  (counter_affidavit_due) WHERE counter_affidavit_received IS NULL;

-- ============================================================================
-- LITIGATION: WRITTEN DISCOVERY  (set level + individual request level)
-- ============================================================================
CREATE TABLE litigation.discovery_set (
  discovery_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('propounded','received')),
  set_type text NOT NULL CHECK (set_type IN
    ('initial_disclosures_194','interrogatories','requests_for_production',
     'requests_for_admission','requests_for_disclosure_legacy',
     'deposition_on_written_questions','expert_disclosures','pretrial_disclosures')),
  set_number int NOT NULL DEFAULT 1,
  propounding_party_id uuid REFERENCES litigation.lit_party(lit_party_id),
  responding_party_id uuid REFERENCES litigation.lit_party(lit_party_id),
  served_date date,
  served_by_mail boolean NOT NULL DEFAULT false,
  response_due date,                     -- use workflow.compute_deadline
  extension_agreed_to date,
  responses_served date,
  verification_received boolean,
  objections_global text,
  document_id uuid REFERENCES workflow.document(document_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dset_case ON litigation.discovery_set (court_case_id);
CREATE INDEX idx_dset_due ON litigation.discovery_set (response_due)
  WHERE responses_served IS NULL;

-- Individual requests: deficiency tracking, meet-and-confer, motion to compel
CREATE TABLE litigation.discovery_request (
  discovery_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_set_id uuid NOT NULL
    REFERENCES litigation.discovery_set(discovery_set_id) ON DELETE CASCADE,
  request_number text NOT NULL,          -- "ROG 7", "RFP 12(a)"
  request_text text,
  response_text text,
  objections text,
  objection_types text[],                -- overbroad, privilege, vague...
  privilege_asserted boolean NOT NULL DEFAULT false,
  answered_status text NOT NULL DEFAULT 'pending' CHECK (answered_status IN
    ('pending','answered','partial','objected_only','refused',
     'will_supplement','supplemented','withdrawn')),
  responsive_bates text,                 -- what production answers this request
  deficiency_status text NOT NULL DEFAULT 'none' CHECK (deficiency_status IN
    ('none','deficient','deficiency_letter_sent','conferred','mtc_filed',
     'mtc_granted','mtc_denied','cured')),
  deficiency_letter_date date,
  ruling text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_request_per_set UNIQUE (discovery_set_id, request_number)
);

-- Productions received (Bates ranges → feeds your production-analysis skills)
CREATE TABLE litigation.production (
  production_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  discovery_set_id uuid REFERENCES litigation.discovery_set(discovery_set_id),
  producing_party_id uuid REFERENCES litigation.lit_party(lit_party_id),
  received_date date,
  bates_prefix text, bates_start text, bates_end text,
  page_count int,
  format text,                           -- pdf, native, video...
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK
    (review_status IN ('unreviewed','in_review','reviewed','analyzed')),
  analysis_document_id uuid REFERENCES workflow.document(document_id),
  key_findings text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LITIGATION: DEPOSITIONS
-- ============================================================================
CREATE TABLE litigation.deposition (
  deposition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  deponent_person_id uuid REFERENCES core.person(person_id),
  deponent_org_id uuid REFERENCES core.organization(organization_id),   -- 199.2(b)(1) corp rep
  deponent_label text NOT NULL,
  depo_type text NOT NULL CHECK (depo_type IN
    ('party_plaintiff','party_defendant','fact_witness','corporate_rep',
     'treating_physician','retained_expert','records_custodian','apex')),
  taken_by text NOT NULL CHECK (taken_by IN ('us','defense','co_party')),
  corp_rep_topics text,                  -- TRCP 199.2(b)(1) matters designated
  notice_served date,
  scheduled_at timestamptz,
  location text, remote boolean NOT NULL DEFAULT false,
  court_reporter_org_id uuid REFERENCES core.organization(organization_id),
  videographer boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'contemplated' CHECK (status IN
    ('contemplated','noticed','scheduled','taken','cancelled','quashed')),
  transcript_received date,
  errata_due date,
  outline_document_id uuid REFERENCES workflow.document(document_id),
  summary_document_id uuid REFERENCES workflow.document(document_id),
  key_admissions text,
  prep_session_done boolean,             -- for our client's depo
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_depo_case ON litigation.deposition (court_case_id);

-- ============================================================================
-- LITIGATION: EXPERTS  (designation deadlines, Robinson/Daubert challenges)
-- ============================================================================
CREATE TABLE litigation.expert (
  expert_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  person_id uuid REFERENCES core.person(person_id),
  expert_firm_org_id uuid REFERENCES core.organization(organization_id),
  side text NOT NULL CHECK (side IN ('plaintiff','defense','court_appointed')),
  specialty text NOT NULL,               -- accident recon, biomech, LCP, economist...
  retained boolean NOT NULL DEFAULT true, -- vs non-retained (treaters)
  designation_due date,
  designated_date date,
  report_required boolean,
  report_served date,
  file_produced boolean,
  deposition_id uuid REFERENCES litigation.deposition(deposition_id),
  challenge_motion_filed date,           -- Robinson / Daubert / 702
  challenge_ruling text CHECK (challenge_ruling IN
    ('pending','granted','denied','partial') OR challenge_ruling IS NULL),
  fees_budgeted numeric(14,2), fees_incurred numeric(14,2),
  engagement_status text NOT NULL DEFAULT 'identified' CHECK (engagement_status IN
    ('identified','conflicts_checked','engaged','working','designated',
     'deposed','testified','released')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- LITIGATION: MOTIONS, HEARINGS, MEDIATION, TRIAL, JUDGMENT
-- ============================================================================
CREATE TABLE litigation.hearing (
  hearing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  hearing_type text NOT NULL,            -- motion hearing, status conf, TCA docket...
  setting_at timestamptz,
  by_submission boolean NOT NULL DEFAULT false,
  location text, remote boolean NOT NULL DEFAULT false,
  attended_by uuid REFERENCES core.staff(staff_id),
  result text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE litigation.motion (
  motion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  motion_type text NOT NULL,             -- msj_traditional, msj_no_evidence, compel,
                                         -- remand, venue_transfer, continuance, limine,
                                         -- quash, spoliation, expert_challenge, new_trial...
  filed_by_side text NOT NULL CHECK (filed_by_side IN ('plaintiff','defense','third_party')),
  filed_date date,
  filing_id uuid REFERENCES litigation.filing(filing_id),
  response_due date,
  response_filed date,
  reply_due date, reply_filed date,
  hearing_id uuid REFERENCES litigation.hearing(hearing_id),
  submission_date date,
  ruling text CHECK (ruling IN
    ('pending','granted','denied','granted_in_part','moot','withdrawn') OR ruling IS NULL),
  order_signed_date date,
  order_document_id uuid REFERENCES workflow.document(document_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_motion_case ON litigation.motion (court_case_id);
CREATE INDEX idx_motion_response_due ON litigation.motion (response_due)
  WHERE response_filed IS NULL AND ruling IS NULL;

-- Mediation can happen pre-suit too, so it attaches matter XOR case
CREATE TABLE litigation.mediation (
  mediation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  court_case_id uuid REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  mediator_person_id uuid REFERENCES core.person(person_id),
  court_ordered boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  location text, remote boolean NOT NULL DEFAULT false,
  position_statement_document_id uuid REFERENCES workflow.document(document_id),
  client_prep_done boolean,
  fee_amount numeric(12,2),
  result text CHECK (result IN
    ('settled','settled_in_part','impasse','continued','cancelled') OR result IS NULL),
  final_offer_defense numeric(14,2),
  final_demand_plaintiff numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mediation_scope_arc CHECK (num_nonnulls(client_matter_id, court_case_id) = 1)
);

CREATE TABLE litigation.trial_setting (
  trial_setting_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  setting_type text NOT NULL DEFAULT 'standard' CHECK
    (setting_type IN ('standard','preferential','special','backup')),
  trial_date date NOT NULL,
  docket_call_at timestamptz,
  announcement_status text,
  continued boolean NOT NULL DEFAULT false,
  continued_by text, continuance_reason text,
  order_document_id uuid REFERENCES workflow.document(document_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE litigation.trial_witness (
  trial_witness_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  person_id uuid REFERENCES core.person(person_id),
  witness_label text NOT NULL,
  side text NOT NULL CHECK (side IN ('plaintiff','defense')),
  call_status text NOT NULL DEFAULT 'may_call' CHECK
    (call_status IN ('will_call','may_call','rebuttal_only','withdrawn')),
  subpoena_issued date, subpoena_served date,
  testimony_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE litigation.exhibit (
  exhibit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('plaintiff','defense','joint')),
  exhibit_number text,
  description text NOT NULL,
  document_id uuid REFERENCES workflow.document(document_id),
  sponsoring_witness_id uuid REFERENCES litigation.trial_witness(trial_witness_id),
  objection text,
  ruling text CHECK (ruling IN ('admitted','excluded','pending','withdrawn') OR ruling IS NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE litigation.depo_designation (
  depo_designation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  deposition_id uuid NOT NULL REFERENCES litigation.deposition(deposition_id),
  side text NOT NULL CHECK (side IN ('plaintiff','defense')),
  page_line_ranges text NOT NULL,        -- "12:5-14:22; 31:1-33:9"
  purpose text,
  objection text,
  ruling text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE litigation.judgment (
  judgment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_case_id uuid NOT NULL REFERENCES litigation.court_case(court_case_id) ON DELETE CASCADE,
  judgment_type text NOT NULL CHECK (judgment_type IN
    ('agreed','default','summary','directed_verdict','jury_verdict','bench',
     'jnov','dismissal_with_prejudice','dismissal_without_prejudice','nonsuit')),
  signed_date date,
  verdict_amount numeric(14,2),
  economic_damages numeric(14,2),
  noneconomic_damages numeric(14,2),
  exemplary_damages numeric(14,2),
  comparative_fault_pct int CHECK (comparative_fault_pct BETWEEN 0 AND 100),
  prejudgment_interest numeric(14,2),
  taxable_costs numeric(14,2),
  motion_new_trial_due date,             -- plenary power / appellate clock
  notice_of_appeal_due date,
  appeal_filed boolean NOT NULL DEFAULT false,
  appellate_court text, appellate_cause_no text,
  collected_amount numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- FINANCE: FEE AGREEMENTS & FEE SPLITS
-- ============================================================================
CREATE TABLE finance.fee_agreement (
  fee_agreement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  agreement_type text NOT NULL DEFAULT 'contingency' CHECK
    (agreement_type IN ('contingency','hourly','hybrid','flat')),
  pct_pre_suit numeric(5,2) CHECK (pct_pre_suit BETWEEN 0 AND 100),
  pct_post_filing numeric(5,2) CHECK (pct_post_filing BETWEEN 0 AND 100),
  pct_appeal numeric(5,2) CHECK (pct_appeal BETWEEN 0 AND 100),
  expenses_off_top boolean,              -- fee calc before/after expenses
  executed_date date,
  document_id uuid REFERENCES workflow.document(document_id),
  superseded_by uuid REFERENCES finance.fee_agreement(fee_agreement_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Referral / co-counsel splits (TDRPC 1.04(f): disclosure + client consent)
CREATE TABLE finance.fee_split (
  fee_split_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  other_firm_org_id uuid NOT NULL REFERENCES core.organization(organization_id),
  basis text NOT NULL CHECK (basis IN ('referral','joint_responsibility','co_counsel')),
  split_pct numeric(5,2),
  split_flat_amount numeric(14,2),
  client_disclosure_document_id uuid REFERENCES workflow.document(document_id),
  client_consent_date date,
  paid_date date, paid_amount numeric(14,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- FINANCE: CASE EXPENSES
-- ============================================================================
CREATE TABLE finance.case_expense (
  case_expense_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES ref.expense_category(code),
  vendor_org_id uuid REFERENCES core.organization(organization_id),
  incurred_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  description text,
  invoice_document_id uuid REFERENCES workflow.document(document_id),
  paid_date date, paid_method text, paid_from text CHECK
    (paid_from IN ('operating','trust','credit_line') OR paid_from IS NULL),
  reimbursable boolean NOT NULL DEFAULT true,
  approved_by uuid REFERENCES core.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expense_matter ON finance.case_expense (client_matter_id);

ALTER TABLE medical.record_request
  ADD CONSTRAINT fk_recreq_expense FOREIGN KEY (case_expense_id)
  REFERENCES finance.case_expense(case_expense_id);
ALTER TABLE workflow.public_records_request
  ADD CONSTRAINT fk_prr_expense FOREIGN KEY (case_expense_id)
  REFERENCES finance.case_expense(case_expense_id);

-- ============================================================================
-- FINANCE: TRUST (IOLTA) LEDGER
-- Client funds must never go negative per matter — enforced by trigger.
-- ============================================================================
CREATE TABLE finance.trust_account (
  trust_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  bank_name text NOT NULL,
  account_last4 text,
  iolta boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finance.trust_transaction (
  trust_transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_account_id uuid NOT NULL REFERENCES finance.trust_account(trust_account_id),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id),
  txn_type text NOT NULL CHECK (txn_type IN ('deposit','disbursement','transfer_in','transfer_out')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  txn_date date NOT NULL DEFAULT CURRENT_DATE,
  payee_or_payor text NOT NULL,
  method text CHECK (method IN ('check','wire','ach','internal') OR method IS NULL),
  reference_number text,                 -- check number / wire confirmation
  memo text,
  cleared_date date,
  reconciled_period text,                -- 'YYYY-MM' three-way reconciliation tag
  voided boolean NOT NULL DEFAULT false,
  void_reason text,
  created_by uuid REFERENCES core.staff(staff_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trust_matter ON finance.trust_transaction (client_matter_id);

CREATE OR REPLACE FUNCTION finance.matter_trust_balance(p_matter uuid)
RETURNS numeric AS $$
  SELECT coalesce(sum(CASE WHEN txn_type IN ('deposit','transfer_in') THEN amount
                           ELSE -amount END), 0)
  FROM finance.trust_transaction
  WHERE client_matter_id = p_matter AND NOT voided;
$$ LANGUAGE sql STABLE;

-- Guard on INSERT: a disbursement may not exceed the matter's balance.
CREATE OR REPLACE FUNCTION finance.prevent_trust_overdraft() RETURNS trigger AS $$
BEGIN
  IF NEW.txn_type IN ('disbursement','transfer_out')
     AND finance.matter_trust_balance(NEW.client_matter_id) < NEW.amount THEN
    RAISE EXCEPTION 'trust overdraft blocked: matter % balance % is less than %',
      NEW.client_matter_id,
      finance.matter_trust_balance(NEW.client_matter_id), NEW.amount;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trust_no_overdraft
  BEFORE INSERT ON finance.trust_transaction
  FOR EACH ROW EXECUTE FUNCTION finance.prevent_trust_overdraft();

-- Guard on UPDATE: voiding/un-voiding or editing a transaction must never
-- leave the matter's ledger negative (e.g., voiding a deposit after funds
-- were disbursed).  Checked AFTER the row change so the function sees the
-- post-update ledger.
CREATE OR REPLACE FUNCTION finance.recheck_trust_balance() RETURNS trigger AS $$
BEGIN
  IF finance.matter_trust_balance(NEW.client_matter_id) < 0 THEN
    RAISE EXCEPTION 'trust ledger violation: change would leave matter % with negative balance %',
      NEW.client_matter_id, finance.matter_trust_balance(NEW.client_matter_id);
  END IF;
  IF OLD.client_matter_id IS DISTINCT FROM NEW.client_matter_id
     AND finance.matter_trust_balance(OLD.client_matter_id) < 0 THEN
    RAISE EXCEPTION 'trust ledger violation: change would leave matter % with negative balance %',
      OLD.client_matter_id, finance.matter_trust_balance(OLD.client_matter_id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trust_recheck_on_update
  AFTER UPDATE ON finance.trust_transaction
  FOR EACH ROW EXECUTE FUNCTION finance.recheck_trust_balance();

-- ============================================================================
-- FINANCE: DISBURSEMENT / SETTLEMENT STATEMENT
-- ============================================================================
CREATE TABLE finance.disbursement_statement (
  disbursement_statement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_matter_id uuid NOT NULL REFERENCES core.client_matter(client_matter_id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES resolution.settlement(settlement_id),
  gross_recovery numeric(14,2) NOT NULL,
  attorney_fee numeric(14,2) NOT NULL DEFAULT 0,
  fee_pct_applied numeric(5,2),
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  total_liens numeric(14,2) NOT NULL DEFAULT 0,
  net_to_client numeric(14,2) NOT NULL DEFAULT 0,
  prepared_by uuid REFERENCES core.staff(staff_id),
  reviewed_by uuid REFERENCES core.staff(staff_id),      -- attorney review
  client_approved_date date,
  client_signature_document_id uuid REFERENCES workflow.document(document_id),
  fully_disbursed_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft','attorney_review','client_review','approved','disbursing','complete','void')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disb_math CHECK
    (net_to_client = gross_recovery - attorney_fee - total_expenses - total_liens)
);

CREATE TABLE finance.disbursement_line (
  disbursement_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_statement_id uuid NOT NULL
    REFERENCES finance.disbursement_statement(disbursement_statement_id) ON DELETE CASCADE,
  line_type text NOT NULL CHECK (line_type IN
    ('attorney_fee','fee_split','expense_reimbursement','lien_payment',
     'provider_payment','client_payment','other')),
  payee text NOT NULL,
  lien_id uuid REFERENCES liens.lien(lien_id),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  trust_transaction_id uuid REFERENCES finance.trust_transaction(trust_transaction_id),
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- AUDIT: IMMUTABLE ROW-CHANGE LOG (generic trigger; attach broadly)
-- ============================================================================
CREATE TABLE audit.change_log (
  change_log_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_name text NOT NULL,
  table_name text NOT NULL,
  row_pk uuid,
  op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  old_row jsonb,
  new_row jsonb,
  changed_by uuid,                       -- from app.staff_id session GUC
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_row ON audit.change_log (table_name, row_pk);

-- Make the audit log PHYSICALLY immutable, not just immutable by convention.
CREATE OR REPLACE FUNCTION audit.block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit.change_log is append-only; % is not permitted', TG_OP;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON audit.change_log
  FOR EACH ROW EXECUTE FUNCTION audit.block_mutation();

CREATE OR REPLACE FUNCTION audit.log_change() RETURNS trigger AS $$
DECLARE v_pk uuid;
BEGIN
  v_pk := (to_jsonb(coalesce(NEW, OLD)) ->> TG_ARGV[0])::uuid;
  INSERT INTO audit.change_log
    (schema_name, table_name, row_pk, op, old_row, new_row, changed_by)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_pk, TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          nullif(current_setting('app.staff_id', true), '')::uuid);
  RETURN coalesce(NEW, OLD);
END $$ LANGUAGE plpgsql;

-- ============================================================================
-- INSTRUMENTATION: register entities + updated_at + audit on key tables
-- ============================================================================
SELECT core.instrument_table('core','incident_group','incident_group_id','incident_group');
SELECT core.instrument_table('core','client_matter','client_matter_id','client_matter');
SELECT core.instrument_table('core','intake_lead','intake_lead_id','intake_lead');
SELECT core.instrument_table('core','person','person_id','person');
SELECT core.instrument_table('core','organization','organization_id','organization');
SELECT core.instrument_table('insurance','policy','policy_id','insurance_policy');
SELECT core.instrument_table('insurance','claim','claim_id','insurance_claim');
SELECT core.instrument_table('medical','treatment_episode','treatment_episode_id','treatment_episode');
SELECT core.instrument_table('property','pd_claim','pd_claim_id','pd_claim');
SELECT core.instrument_table('liens','lien','lien_id','lien');
SELECT core.instrument_table('resolution','demand','demand_id','demand');
SELECT core.instrument_table('resolution','settlement','settlement_id','settlement');
SELECT core.instrument_table('litigation','court_case','court_case_id','court_case');
SELECT core.instrument_table('litigation','deposition','deposition_id','deposition');
SELECT core.instrument_table('litigation','discovery_set','discovery_set_id','discovery_set');
SELECT core.instrument_table('litigation','motion','motion_id','motion');
SELECT core.instrument_table('litigation','expert','expert_id','expert');
SELECT core.instrument_table('litigation','mediation','mediation_id','mediation');
SELECT core.instrument_table('finance','disbursement_statement','disbursement_statement_id','disbursement_statement');
-- v1.1: registry coverage for objects that carry their own tasks/notes/flags
-- (aging record requests, hearing prep, service diligence, judgment deadlines,
-- production review, per-request discovery deficiencies)
SELECT core.instrument_table('medical','record_request','record_request_id','record_request');
SELECT core.instrument_table('litigation','hearing','hearing_id','hearing');
SELECT core.instrument_table('litigation','trial_setting','trial_setting_id','trial_setting');
SELECT core.instrument_table('litigation','judgment','judgment_id','judgment');
SELECT core.instrument_table('litigation','production','production_id','production');
SELECT core.instrument_table('litigation','service_of_process','service_id','service_of_process');
SELECT core.instrument_table('litigation','filing','filing_id','filing');
SELECT core.instrument_table('litigation','discovery_request','discovery_request_id','discovery_request');
SELECT core.instrument_table('litigation','lit_party','lit_party_id','lit_party');
  -- per-DEFENDANT deadlines (answer, initial disclosures, 18.001 windows,
  -- Ch. 74 expert report) attach to the lit_party entity, not just the case
SELECT core.instrument_table('workflow','viability_review','viability_review_id','viability_review');
SELECT core.instrument_table('workflow','public_records_request','public_records_request_id','public_records_request');

-- Audit the most consequential tables (extend as desired)
CREATE TRIGGER trg_audit_matter AFTER INSERT OR UPDATE OR DELETE ON core.client_matter
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('client_matter_id');
CREATE TRIGGER trg_audit_trust AFTER INSERT OR UPDATE OR DELETE ON finance.trust_transaction
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('trust_transaction_id');
CREATE TRIGGER trg_audit_disb AFTER INSERT OR UPDATE OR DELETE ON finance.disbursement_statement
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('disbursement_statement_id');
CREATE TRIGGER trg_audit_lien AFTER INSERT OR UPDATE OR DELETE ON liens.lien
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('lien_id');
CREATE TRIGGER trg_audit_settlement AFTER INSERT OR UPDATE OR DELETE ON resolution.settlement
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('settlement_id');
CREATE TRIGGER trg_audit_replink AFTER INSERT OR UPDATE OR DELETE ON core.representation_link
  FOR EACH ROW EXECUTE FUNCTION audit.log_change('representation_link_id');

-- ============================================================================
-- DASHBOARD VIEWS  (your Section 14 red flags, as queryable objects)
-- ============================================================================

-- Stalled Case Dashboard: one row per active matter with every red flag
CREATE OR REPLACE VIEW workflow.v_stalled_cases AS
SELECT
  m.client_matter_id,
  core.matter_display_name(m.client_matter_id) AS display_name,
  m.current_stage,
  m.stage_entered_at,
  (SELECT s.email FROM core.staff_assignment sa
     JOIN core.staff s ON s.staff_id = sa.staff_id
    WHERE sa.client_matter_id = m.client_matter_id
      AND sa.assignment_role = 'case_manager' AND sa.ended_at IS NULL
    LIMIT 1) AS case_manager,
  -- CASE AGE: the lifespan clock runs from SIGN-UP, not the incident — a case
  -- signed six months post-crash starts at day 0. The goal metric.
  (CURRENT_DATE - m.sign_up_date)                              AS case_age_days,
  (extract(epoch FROM (now() - m.stage_entered_at)) / 86400)::int AS days_in_stage,
  (SELECT n.body FROM workflow.note n
    WHERE n.entity_id = m.client_matter_id AND n.pinned AND n.deleted_at IS NULL
    ORDER BY n.created_at DESC LIMIT 1)                        AS critical_note,
  -- TBI carries through as a standing indicator (badge, not a rule):
  -- what to DO about it is a human call based on Level + other injuries +
  -- available coverage
  EXISTS (SELECT 1 FROM medical.injury i
           WHERE i.client_matter_id = m.client_matter_id
             AND i.is_tbi)                                     AS tbi_indicated,
  m.approved_level,
  -- red flags
  (m.approved_level IS NULL
     AND m.sign_up_date IS NOT NULL
     AND m.sign_up_date + 7 < CURRENT_DATE)                    AS flag_missing_level,
  EXISTS (SELECT 1 FROM workflow.viability_review vr
           WHERE vr.client_matter_id = m.client_matter_id
             AND vr.reviewed_at IS NULL
             AND vr.due_date < CURRENT_DATE)                   AS flag_viability_overdue,
  coalesce((SELECT max(cl.occurred_at) FROM workflow.communication_log cl
             WHERE cl.client_matter_id = m.client_matter_id
               AND cl.person_id = m.client_person_id),
           m.created_at) < now() - interval '30 days'          AS flag_no_client_contact_30d,
  EXISTS (SELECT 1 FROM workflow.task t
           WHERE t.client_matter_id = m.client_matter_id
             AND t.task_type = 'provider_call'
             AND t.status IN ('open','in_progress')
             AND t.due_date < CURRENT_DATE)                    AS flag_provider_check_overdue,
  EXISTS (SELECT 1 FROM medical.treatment_episode te
           WHERE te.client_matter_id = m.client_matter_id
             AND te.status IN ('gap_concern','noncompliant'))  AS flag_treatment_compliance,
  (m.current_stage = 'records' AND EXISTS (
     SELECT 1 FROM medical.treatment_episode te
      WHERE te.client_matter_id = m.client_matter_id
        AND te.status = 'completed'
        AND NOT EXISTS (SELECT 1 FROM medical.record_request rr
                         WHERE rr.treatment_episode_id = te.treatment_episode_id
                           AND rr.status <> 'cancelled')))     AS flag_records_not_ordered,
  EXISTS (SELECT 1 FROM property.pd_claim pd
           JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
          WHERE v.incident_group_id = m.incident_group_id
            AND pd.status NOT IN ('resolved','n_a')
            AND m.current_stage IN ('demand','negotiation'))   AS flag_pd_unresolved,
  EXISTS (SELECT 1 FROM resolution.demand d
           WHERE d.client_matter_id = m.client_matter_id
             AND d.sent_date IS NOT NULL
             AND d.response_received IS NULL
             AND d.response_due < CURRENT_DATE)                AS flag_demand_response_overdue,
  EXISTS (SELECT 1 FROM workflow.public_records_request prr
           WHERE (prr.client_matter_id = m.client_matter_id
                  OR prr.incident_group_id = m.incident_group_id)
             AND prr.statute = 'tx_dps_driver_record'
             AND prr.status NOT IN ('fulfilled','denied','withdrawn'))
                                                               AS flag_dps_record_outstanding,
  EXISTS (SELECT 1 FROM workflow.public_records_request prr
           WHERE (prr.client_matter_id = m.client_matter_id
                  OR prr.incident_group_id = m.incident_group_id)
             AND prr.statute <> 'tx_dps_driver_record'
             AND prr.status NOT IN ('fulfilled','denied','withdrawn'))
                                                               AS flag_public_records_outstanding,
  EXISTS (SELECT 1 FROM resolution.settlement st
           WHERE st.client_matter_id = m.client_matter_id
             AND st.agreed_date < CURRENT_DATE - 60
             AND NOT EXISTS (SELECT 1 FROM finance.disbursement_statement ds
                              WHERE ds.client_matter_id = m.client_matter_id
                                AND ds.status = 'complete'))   AS flag_disbursement_aging,
  (m.sol_date IS NOT NULL AND m.sol_date < CURRENT_DATE + 120
     AND m.current_stage NOT IN ('closed'))                    AS flag_sol_within_120d
FROM core.client_matter m
WHERE m.deleted_at IS NULL
  AND m.representation_status = 'active'
  AND m.current_stage <> 'closed';

-- Treatment / provider contact worklist (bi-weekly call queue)
CREATE OR REPLACE VIEW medical.v_provider_calls_due AS
SELECT t.task_id, t.client_matter_id,
       core.matter_display_name(t.client_matter_id) AS display_name,
       t.due_date, t.owner_staff_id,
       te.treatment_episode_id, o.name AS provider_name,
       te.approx_balance, te.balance_as_of, te.status AS episode_status
FROM workflow.task t
JOIN medical.treatment_episode te ON te.client_matter_id = t.client_matter_id
JOIN medical.provider p ON p.provider_id = te.provider_id
JOIN core.organization o ON o.organization_id = p.organization_id
WHERE t.task_type = 'provider_call'
  AND t.status IN ('open','in_progress')
  AND te.is_primary_pm
  AND te.status IN ('scheduled','active','gap_concern')
ORDER BY t.due_date;

-- Demand readiness queue
CREATE OR REPLACE VIEW resolution.v_demand_readiness AS
SELECT m.client_matter_id,
       core.matter_display_name(m.client_matter_id) AS display_name,
       m.approved_level,
       bool_and(te.status IN ('completed','cut_off','discharged','never_treated'))
         FILTER (WHERE te.treatment_episode_id IS NOT NULL) AS treatment_complete,
       count(rr.record_request_id) FILTER
         (WHERE rr.status NOT IN ('received','cancelled')) AS records_outstanding,
       NOT EXISTS (SELECT 1 FROM property.pd_claim pd
                    JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
                   WHERE v.incident_group_id = m.incident_group_id
                     AND pd.status NOT IN ('resolved','n_a')) AS pd_clear,
       d.demand_id, d.reviewed_at IS NOT NULL AS kate_reviewed,
       (m.approved_level = 3) AS needs_attorney_approval,
       d.attorney_approved_at IS NOT NULL AS attorney_approved
FROM core.client_matter m
LEFT JOIN medical.treatment_episode te ON te.client_matter_id = m.client_matter_id
LEFT JOIN medical.record_request rr ON rr.treatment_episode_id = te.treatment_episode_id
LEFT JOIN resolution.demand d ON d.client_matter_id = m.client_matter_id
                              AND d.sent_date IS NULL
WHERE m.deleted_at IS NULL AND m.current_stage IN ('records','demand')
GROUP BY m.client_matter_id, d.demand_id, d.reviewed_at, d.attorney_approved_at,
         m.approved_level;

-- Emily's lien worklist
CREATE OR REPLACE VIEW liens.v_lien_worklist AS
SELECT l.lien_id, l.client_matter_id,
       core.matter_display_name(l.client_matter_id) AS display_name,
       lt.label AS lien_type, o.name AS holder,
       l.status, l.asserted_amount, l.verified_amount, l.negotiated_amount,
       l.flagged_for_resolution_date, l.owner_staff_id,
       m.current_stage,
       EXISTS (SELECT 1 FROM resolution.settlement s
                WHERE s.client_matter_id = l.client_matter_id) AS matter_settled
FROM liens.lien l
JOIN ref.lien_type lt ON lt.code = l.lien_type_code
JOIN core.client_matter m ON m.client_matter_id = l.client_matter_id
LEFT JOIN core.organization o ON o.organization_id = l.holder_org_id
WHERE l.status NOT IN ('resolved','waived','not_applicable')
  AND l.deleted_at IS NULL
ORDER BY matter_settled DESC, l.flagged_for_resolution_date;

-- Property Damage Aging Report (planning doc §8 — v1.1 addition)
CREATE OR REPLACE VIEW property.v_pd_aging AS
SELECT pd.pd_claim_id, v.incident_group_id,
       v.year, v.make, v.model,
       pd.status, pd.owner_staff_id, pd.opened_date, pd.last_touch_date,
       (CURRENT_DATE - pd.last_touch_date) AS days_since_touch,
       pd.repairable_or_total, pd.valuation_received, pd.valuation_reviewed,
       pd.lienholder_resolved, pd.loss_of_use_pursued,
       pd.diminished_value_evaluated, pd.demand_blocker,
       v.storage_accruing,
       EXISTS (SELECT 1 FROM core.client_matter m
                WHERE m.incident_group_id = v.incident_group_id
                  AND m.deleted_at IS NULL
                  AND m.current_stage IN ('demand','negotiation'))
         AS matter_at_demand_stage
FROM property.pd_claim pd
JOIN property.vehicle v ON v.vehicle_id = pd.vehicle_id
WHERE pd.status NOT IN ('resolved','n_a')
ORDER BY matter_at_demand_stage DESC, days_since_touch DESC NULLS LAST;

-- Litigation deadline horizon (next 45 days, all cases)
CREATE OR REPLACE VIEW litigation.v_deadline_horizon AS
SELECT d.deadline_id, d.client_matter_id,
       core.matter_display_name(d.client_matter_id) AS display_name,
       d.label, d.effective_date, d.jurisdictional, d.owner_staff_id,
       r.authority
FROM workflow.deadline d
LEFT JOIN ref.deadline_rule r ON r.code = d.rule_code
WHERE d.status = 'pending'
  AND d.effective_date <= CURRENT_DATE + 45
ORDER BY d.effective_date, d.jurisdictional DESC;

-- Stage velocity: completed stage durations across all matters. This is the
-- "shorten every case's lifespan" instrument — it shows WHERE days are spent
-- and whether changes move the number.
CREATE OR REPLACE VIEW analytics.v_stage_velocity AS
SELECT sh.stage_code,
       count(*)                                             AS completed_stints,
       round(avg(extract(epoch FROM (sh.exited_at - sh.entered_at)) / 86400)::numeric, 1)
                                                            AS avg_days,
       round((percentile_cont(0.5) WITHIN GROUP
         (ORDER BY extract(epoch FROM (sh.exited_at - sh.entered_at)) / 86400))::numeric, 1)
                                                            AS median_days,
       round((percentile_cont(0.9) WITHIN GROUP
         (ORDER BY extract(epoch FROM (sh.exited_at - sh.entered_at)) / 86400))::numeric, 1)
                                                            AS p90_days
FROM core.stage_history sh
WHERE sh.exited_at IS NOT NULL
GROUP BY sh.stage_code
ORDER BY min((SELECT ms.sort FROM ref.matter_stage ms WHERE ms.code = sh.stage_code));

-- ============================================================================
-- ANALYTICS: CLOSED-CASE VALUATION SNAPSHOT
-- Frozen at close by finalize_matter_close(); powers future case valuation.
-- ============================================================================
CREATE TABLE analytics.closed_case_snapshot (
  client_matter_id uuid PRIMARY KEY REFERENCES core.client_matter(client_matter_id),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  case_type text, county text, venue_county text,
  case_manager text, disposition text, settled_stage text,
  date_of_loss date, sign_up_date date, close_date date,
  days_signup_to_close int,
  approved_level smallint,
  policy_dinsco_limits numeric(14,2),
  gross_recovery numeric(14,2),
  attorney_fee numeric(14,2),
  total_expenses numeric(14,2),
  total_medical_billed numeric(14,2),
  total_liens_asserted numeric(14,2),
  total_liens_final numeric(14,2),
  lien_reduction_pct numeric(5,2),
  net_to_client numeric(14,2),
  had_surgery boolean, had_injections boolean, had_mri boolean,
  commercial_defendant boolean,
  litigation_filed boolean,
  intake_source text, referral_source text, marketing_source text
);

CREATE OR REPLACE FUNCTION analytics.finalize_matter_close(p_matter uuid)
RETURNS void AS $$
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
$$ LANGUAGE sql;

-- ============================================================================
-- TYPE-AHEAD SEARCH SUPPORT (pg_trgm)
-- The UI fires ILIKE '%…%' queries as the user types; these GIN trigram
-- indexes make substring/fuzzy matching fast on every column a search bar
-- or dropdown will hit.  B-tree indexes cannot serve these queries.
-- ============================================================================
CREATE INDEX idx_person_trgm ON core.person
  USING gin ((last_name || ' ' || first_name || ' ' || coalesce(middle_name,'')
              || ' ' || coalesce(goes_by,'')) gin_trgm_ops);
CREATE INDEX idx_org_trgm ON core.organization
  USING gin (name gin_trgm_ops);
CREATE INDEX idx_matter_number_trgm ON core.client_matter
  USING gin (matter_number gin_trgm_ops);
CREATE INDEX idx_cause_number_trgm ON litigation.court_case
  USING gin (cause_number gin_trgm_ops);
CREATE INDEX idx_litparty_name_trgm ON litigation.lit_party
  USING gin (pleaded_name gin_trgm_ops);
CREATE INDEX idx_claim_number_trgm ON insurance.claim
  USING gin (claim_number gin_trgm_ops);

-- One search endpoint for the global search bar (and conflict-check lookups):
-- returns typed, ranked matches across people, orgs, matters, and cases.
CREATE OR REPLACE FUNCTION core.quick_search(q text, max_rows int DEFAULT 20)
RETURNS TABLE (result_type text, result_id uuid, label text, sublabel text, rank real)
AS $$
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
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- SEED DATA
-- ============================================================================
INSERT INTO ref.matter_stage (code, label, sort, is_terminal) VALUES
 ('intake','Intake / Case Opening',1,false),
 ('viability','7-Day Viability Review',2,false),
 ('treating','Treating',3,false),
 ('records','Records',4,false),
 ('demand','Demand',5,false),
 ('negotiation','Negotiation',6,false),
 ('litigation','Litigation',7,false),
 ('settlement','Settlement / Disbursement',8,false),
 ('closed','Closed',9,true);

INSERT INTO ref.case_type (code, label, sort) VALUES
 ('auto','Auto Collision',1), ('trucking','Commercial Trucking / FMCSR',2),
 ('motorcycle','Motorcycle',3), ('pedestrian','Pedestrian / Bicycle',4),
 ('premises','Premises Liability',5), ('work_injury','Work Injury / Non-subscriber',6),
 ('product','Product Liability',7), ('dram_shop','Dram Shop',8),
 ('dog_bite','Animal Attack',9), ('wrongful_death','Wrongful Death / Survival',10),
 ('other','Other',99);

INSERT INTO ref.staff_role (code, label) VALUES
 ('attorney','Attorney'), ('senior_paralegal','Senior Paralegal'),
 ('case_manager','Case Manager'), ('demand_writer','Demand Writer'),
 ('lien_disbursement','Lien / Disbursement Specialist'),
 ('litigation_paralegal','Litigation Paralegal'),
 ('records_clerk','Records Clerk'), ('intake','Intake Specialist'),
 ('admin','Administrative');

INSERT INTO ref.party_role (code, label, side) VALUES
 ('client','Client',                'client'),
 ('adverse_driver','Adverse Driver','adverse'),
 ('adverse_owner','Adverse Vehicle Owner','adverse'),
 ('adverse_employer','Adverse Employer / Motor Carrier','adverse'),
 ('premises_owner','Premises Owner/Operator','adverse'),
 ('governmental_unit','Governmental Unit','adverse'),
 ('product_entity','Product Manufacturer/Seller','adverse'),
 ('dram_shop_provider','Alcohol Provider','adverse'),
 ('unrepresented_passenger','Unrepresented Passenger','neutral'),
 ('witness','Witness','neutral'),
 ('lienholder','Vehicle Lienholder','other'),
 ('prior_attorney','Prior Attorney','other'),
 ('next_friend','Next Friend / Guardian','client'),
 ('employer_of_client','Client Employer','neutral');

INSERT INTO ref.lien_type (code, label, federal, statute_cite) VALUES
 ('oag_child_support','OAG Child Support',false,'Tex. Fam. Code ch. 231'),
 ('medicare','Medicare Conditional Payments',true,'42 U.S.C. 1395y(b) (MSP)'),
 ('medicare_advantage','Medicare Advantage (Part C)',true,'42 C.F.R. 422.108'),
 ('medicaid','Texas Medicaid (HHSC)',false,'Tex. Hum. Res. Code 32.033'),
 ('erisa','ERISA Plan Reimbursement',true,'29 U.S.C. 1132(a)(3)'),
 ('private_health','Private Health Subrogation',false,'Tex. Civ. Prac. & Rem. Code ch. 140'),
 ('hospital','Hospital Lien',false,'Tex. Prop. Code ch. 55'),
 ('provider_lop','Provider Letter of Protection',false,NULL),
 ('workers_comp','Workers Comp Carrier Subrogation',false,'Tex. Lab. Code 417.001'),
 ('va_tricare','VA / TRICARE',true,'42 U.S.C. 2651 (FMCRA)'),
 ('prior_attorney_fee','Prior Attorney Fee Lien',false,NULL),
 ('pip_reimbursement','PIP Reimbursement Claim',false,NULL),
 ('child_support_other','Other Child Support Lien',false,NULL);

INSERT INTO ref.expense_category (code, label, taxable_cost) VALUES
 ('filing_fees','Filing / Citation Fees',true),
 ('service_of_process','Service of Process',true),
 ('medical_records','Medical Records / Bills Copies',false),
 ('police_report','Crash / Police Reports',false),
 ('expert_fees','Expert Fees',false),
 ('deposition','Deposition / Court Reporter',true),
 ('mediation','Mediation Fees',false),
 ('investigation','Investigation',false),
 ('travel','Travel',false),
 ('medical_advance','Client Medical Advance',false),
 ('trial_exhibits','Trial Exhibits / Demonstratives',false),
 ('postage_copies','Postage / Copies',false),
 ('interpreter','Interpreter / Translation',false),
 ('other','Other',false);

-- Document types (v1.1 — was unseeded, which made workflow.document unusable)
INSERT INTO ref.document_type (code, label, category) VALUES
 ('contract','Employment Contract / Fee Agreement','intake'),
 ('hipaa_auth','HIPAA / Medical Authorization','intake'),
 ('other_auth','Other Authorization (employment, wage)','intake'),
 ('lor','Letter of Representation','claims'),
 ('lop','Letter of Protection','medical'),
 ('police_report','Police / Crash Report (CR-3)','investigation'),
 ('photos_video','Photos / Video / Scene Evidence','investigation'),
 ('preservation_letter','Spoliation / Preservation Letter','investigation'),
 ('dec_sheet','Declarations Page / Coverage Docs','claims'),
 ('policy_limits_response','Policy Limits Disclosure','claims'),
 ('medical_records','Medical Records','medical'),
 ('medical_bills','Medical Bills','medical'),
 ('affidavit_18001','CPRC 18.001 Affidavit','medical'),
 ('counter_affidavit','18.001 Counter-Affidavit','medical'),
 ('wage_verification','Wage / Employment Verification','damages'),
 ('demand_letter','Demand Letter','resolution'),
 ('settlement_release','Release','resolution'),
 ('settlement_statement','Disbursement / Settlement Statement','resolution'),
 ('lien_correspondence','Lien Correspondence','liens'),
 ('conflict_waiver','Conflict Waiver / Joint Rep Consent','intake'),
 ('non_engagement','Non-Engagement Letter','intake'),
 ('petition','Petition','litigation'),
 ('citation','Citation / Return of Service','litigation'),
 ('answer','Answer','litigation'),
 ('dco','Docket Control / Scheduling Order','litigation'),
 ('written_discovery','Written Discovery / Responses','litigation'),
 ('production','Document Production','litigation'),
 ('depo_transcript','Deposition Transcript','litigation'),
 ('depo_outline','Deposition Outline','litigation'),
 ('depo_summary','Deposition Summary','litigation'),
 ('expert_report','Expert Report / Designation','litigation'),
 ('motion','Motion / Response / Reply','litigation'),
 ('order','Court Order','litigation'),
 ('rule_11_agreement','Rule 11 Agreement','litigation'),
 ('mediation_statement','Mediation Position Statement','litigation'),
 ('trial_exhibit','Trial Exhibit','litigation'),
 ('judgment_doc','Judgment / Verdict','litigation'),
 ('foia_request','FOIA Request (federal)','investigation'),
 ('pia_request','Texas PIA Request (Gov''t Code ch. 552)','investigation'),
 ('dps_driving_record','TX DPS Driving Record Request','investigation'),
 ('correspondence','General Correspondence','general'),
 ('other','Other','general');

INSERT INTO ref.clinical_event_type (code, label, value_signal) VALUES
 ('er_visit','Emergency Room Visit',false),
 ('ambulance','Ambulance Transport',false),
 ('initial_visit','Initial Visit (PM/PONS)',false),
 ('xray','X-Ray',false),
 ('mri_referral','MRI Referral (track facility)',true),
 ('mri','MRI Completed',true),
 ('ct','CT Scan',true),
 ('emg','EMG / Nerve Study',true),
 ('tpi','Trigger Point Injections',true),
 ('esi','Epidural Steroid Injection',true),
 ('mbb','Medial Branch Block',true),
 ('rfa','Radiofrequency Ablation',true),
 ('neuropsych_eval','Neuropsych Evaluation (TBI workup)',true),
 ('surgical_referral','Surgical Referral',true),
 ('surgical_consult','Surgical Consultation',true),
 ('surgery','Surgery',true),
 ('impairment_rating','Impairment Rating',true),
 ('discharge','Discharge / MMI',false);
-- PM-call checklist mapping: initial visit -> initial_visit(completed);
-- MRI referral + facility -> mri_referral(referred_to);
-- TPI -> tpi; ESI/MBB per region -> esi/mbb + body_region;
-- RFA recommendation -> rfa(recommended, region); RFA complete -> rfa(completed);
-- surgical referral -> surgical_referral.

-- Texas deadline rules — STARTER SET.
-- >>> Every rule below must be attorney-verified before production use; <<<
-- >>> rules change (e.g., 2021 TRCP amendments) and county practice varies. <<<
-- v1.1 corrections: limitations & TTCA now use true calendar year/month units
-- (Gov't Code 311.014), backward-counted rules roll to the PREVIOUS business
-- day, and TRCP 99 uses strictly-after Monday.
INSERT INTO ref.deadline_rule
 (code,label,authority,day_count,count_unit,count_method,roll_rule,service_mail_extension,jurisdictional,applies_to,notes) VALUES
 ('sol_pi_2yr','Personal injury limitations','CPRC 16.003',2,'year','calendar','none',false,true,'both',
   'Two years from accrual (anniversary method). Verify tolling (minor 16.001, incapacity) and notice prerequisites. Weekend/holiday extension per CPRC 16.072 — leave roll off and calendar the true date.'),
 ('sol_wd_2yr','Wrongful death/survival limitations','CPRC 16.003(b)',2,'year','calendar','none',false,true,'both',
   'Two years from DATE OF DEATH, not date of injury.'),
 ('ttca_notice_6mo','TTCA notice of claim','CPRC 101.101',6,'month','calendar','none',false,true,'prelit',
   'Six calendar months from incident. CHECK CITY CHARTER — many require 45-90 days.'),
 ('ins542a_notice_61','Pre-suit notice, insurer bad faith (UM/UIM etc.)','Tex. Ins. Code 542A.003',-61,'day','calendar','prev_business',false,false,'prelit',
   'Notice must be given at least 61 days BEFORE filing suit on a Ch. 541/542 claim (base = planned filing date). Verify applicability.'),
 ('answer_monday_next_20','Answer due (state citation)','TRCP 99(b)',20,'day','calendar','next_monday',false,false,'litigation',
   'Monday next after expiration of 20 days after service (strictly after — if day 20 is a Monday, due the following Monday).'),
 ('discovery_response_30','Written discovery responses','TRCP 193.1 / 196-198',30,'day','calendar','next_business',true,false,'litigation',
   'Thirty days after service.'),
 ('discovery_response_50','Written discovery served with/before citation','TRCP 196.2(a) etc.',50,'day','calendar','next_business',true,false,'litigation',
   'Fifty days after service when discovery is served before the answer is due.'),
 ('initial_disclosures_30','Initial disclosures','TRCP 194.2',30,'day','calendar','next_business',false,false,'litigation',
   'Due 30 days after first answer is filed (post-2021 rules).'),
 ('msj_notice_21','MSJ hearing notice','TRCP 166a(c)',21,'day','calendar','next_business',false,false,'litigation',
   'Motion + notice served at least 21 days before hearing.'),
 ('msj_response_7','MSJ response','TRCP 166a(c)',-7,'day','calendar','prev_business',false,false,'litigation',
   'Response due 7 days before hearing (backward count — rolls EARLIER, never later).'),
 ('expert_desig_p_90','Plaintiff expert designation','TRCP 195.2(a)',-90,'day','calendar','prev_business',false,false,'litigation',
   'Ninety days before end of discovery period (base = discovery_period_end). Backward count rolls earlier.'),
 ('expert_desig_d_60','Defense expert designation','TRCP 195.2(b)',-60,'day','calendar','prev_business',false,false,'litigation',
   'Sixty days before end of discovery period. Backward count rolls earlier.'),
 ('pretrial_disclosures_30','Pretrial disclosures','TRCP 194.4',-30,'day','calendar','prev_business',false,false,'litigation',
   'Witness/exhibit disclosures at least 30 days before trial (base = trial date).'),
 ('jury_demand_30','Jury demand + fee','TRCP 216',-30,'day','calendar','prev_business',false,false,'litigation',
   'Written demand and fee at least 30 days before trial setting (file far earlier in practice).'),
 ('mnt_30','Motion for new trial','TRCP 329b(a)',30,'day','calendar','next_business',false,true,'litigation',
   'Thirty days after judgment signed.'),
 ('noa_state_30','Notice of appeal (state)','TRAP 26.1',30,'day','calendar','next_business',false,true,'litigation',
   'Thirty days after judgment; 90 if MNT timely filed.'),
 ('removal_30','Removal window (defense)','28 U.S.C. 1446(b)',30,'day','calendar','next_business',false,true,'litigation',
   'Track defensively: defendant has 30 days from service to remove.'),
 ('remand_motion_30','Motion to remand (procedural defects)','28 U.S.C. 1447(c)',30,'day','calendar','next_business',false,true,'litigation',
   'Thirty days after notice of removal for non-jurisdictional defects.'),
 ('ch74_notice_60','Ch. 74 pre-suit notice','CPRC 74.051',-60,'day','calendar','prev_business',false,true,'prelit',
   'Notice at least 60 days BEFORE filing a health care liability claim (base = planned filing date); tolls SOL 75 days.'),
 ('ch74_expert_120','Ch. 74 expert report','CPRC 74.351',120,'day','calendar','next_business',false,true,'litigation',
   'One hundred twenty days after each defendant answer.'),
 ('depo_errata_20','Deposition errata/signature','TRCP 203.1',20,'day','calendar','next_business',false,false,'litigation',
   'Twenty days after transcript provided to witness.'),
 ('initial_disclosures_later_served_30','Initial disclosures — later-served defendant','TRCP 194.2(b)',30,'day','calendar','next_business',false,false,'litigation',
   'A party first served or joined AFTER the first answer discloses within 30 days of being served/joined. Base = THAT defendant''s service date. One deadline per defendant.'),
 ('aff18001_serve_90','Serve 18.001 affidavits (per defendant)','CPRC 18.001(d-1)',90,'day','calendar','prev_business',false,false,'litigation',
   'VERIFY CURRENT STATUTE: serve by the EARLIER of 90 days after this defendant''s answer or the offering party''s expert designation date. Base = that defendant''s answer_filed; compare against expert deadline manually. Rolls earlier to stay safe.'),
 ('aff18001_counter_120','18.001 counter-affidavit window (per defendant)','CPRC 18.001(e)',120,'day','calendar','next_business',false,false,'litigation',
   'VERIFY CURRENT STATUTE: defendant''s counter-affidavit generally due by the earlier of 120 days after that defendant''s answer or a court-set date. Base = that defendant''s answer_filed. Track defensively.'),
 ('foia_response_20bd','FOIA response due (federal agency)','5 U.S.C. 552(a)(6)(A)',20,'day','business','none',false,false,'both',
   'Agency determination due 20 business days from receipt; extensions for unusual circumstances. Track defensively for follow-up, not as our deadline.'),
 ('tpia_response_10bd','Texas PIA response / AG referral window','Tex. Gov''t Code 552.221/552.301',10,'day','business','none',false,false,'both',
   'Governmental body must produce promptly or seek an AG ruling within 10 business days of receipt. Track defensively for follow-up.');

-- Court holidays (extend annually; drives roll_forward()/roll_backward()).
-- NOTE (v1.1): this seed is the FEDERAL list. For TRCP 4 purposes a "legal
-- holiday" includes days the county clerk's office is actually closed —
-- Texas state holidays (Mar 2, Apr 21, Good Friday, day after Thanksgiving,
-- Dec 24/26, etc.) vary BY COUNTY. Before relying on rolled dates in state
-- court, add the closure calendar for each county you file in. Do NOT add
-- holidays speculatively: an extra holiday silently pushes forward-rolled
-- deadlines LATER.
INSERT INTO ref.court_holiday (holiday_date, label) VALUES
 ('2026-01-01','New Year''s Day'), ('2026-01-19','MLK Jr. Day'),
 ('2026-02-16','Presidents Day'), ('2026-05-25','Memorial Day'),
 ('2026-06-19','Juneteenth'), ('2026-07-03','Independence Day (obs.)'),
 ('2026-09-07','Labor Day'), ('2026-11-11','Veterans Day'),
 ('2026-11-26','Thanksgiving'), ('2026-12-25','Christmas Day');

-- Merge-field dictionary (the {{tokens}} templates may use)
INSERT INTO workflow.merge_field (code, label, source_hint, pii) VALUES
 ('firm_name','Firm name','constant: Tuttle Law Firm',false),
 ('today_date','Today''s date','generated at merge time',false),
 ('attorney_name','Responsible attorney','core.staff_assignment role=attorney → person',false),
 ('case_manager_name','Case Manager','core.staff_assignment role=case_manager → person',false),
 ('client_full_name','Client full name','core.person first + middle (if any) + last + suffix, via client_matter.client_person_id',true),
 ('client_first_name','Client first name','core.person.first_name',true),
 ('client_dob','Client date of birth','core.person.date_of_birth',true),
 ('client_address','Client mailing address','core.contact_point kind=address is_primary',true),
 ('client_phone','Client phone','core.contact_point kind=phone is_primary',true),
 ('matter_display_name','Matter display name','core.matter_display_name()',false),
 ('case_type_label','Case type (label)','ref.case_type.label via incident_group.case_type_code',false),
 ('matter_number','Firm file number','core.client_matter.matter_number',false),
 ('date_of_loss','Date of loss','core.incident_group.date_of_loss',false),
 ('incident_county','Incident county','core.incident_group.incident_county',false),
 ('incident_location','Incident location','core.incident_group address fields',false),
 ('sol_date','Limitations date','core.client_matter.sol_date',false),
 ('carrier_name','Insurance carrier','core.organization via insurance.policy.carrier_org_id',false),
 ('claim_number','Claim number','insurance.claim.claim_number',false),
 ('policy_number','Policy number','insurance.policy.policy_number',false),
 ('adjuster_name','Adjuster name','core.person via insurance.claim.adjuster_person_id',false),
 ('provider_name','Medical provider','core.organization via medical.provider',false),
 ('provider_address','Provider records address','core.contact_point of provider org',false),
 ('treatment_date_range','Treatment date range','medical.treatment_episode first/last visit',false),
 ('total_billed','Total billed','sum(medical.bill.total_billed) for matter',false),
 ('defendant_name','Defendant as pleaded','litigation.lit_party.pleaded_name',false),
 ('cause_number','Cause number','litigation.court_case.cause_number',false),
 ('court_name','Court','ref.court.name via court_case.court_id',false),
 ('mediator_name','Mediator','core.person via litigation.mediation.mediator_person_id',false),
 ('settlement_gross','Gross settlement','resolution.settlement.gross_amount',false),
 ('agency_name','Government agency','workflow.public_records_request.agency_name / org',false),
 ('records_description','Records requested','workflow.public_records_request.records_description',false),
 ('request_date_range','Records date range','workflow.public_records_request date_range_from/to',false),
 ('record_subject_name','Record subject (adverse driver)','core.person via public_records_request.subject_person_id',true),
 ('record_subject_dl','Record subject DL number','core.person.drivers_license_no',true),
 ('record_subject_dob','Record subject DOB','core.person.date_of_birth',true);

-- Starter template registry.  Word/Excel masters get file_path when you
-- provide them; the two standard emails ship with working bodies now.
INSERT INTO workflow.template
 (code, name, output_kind, produces_doc_type, suggested_stage, trigger_event,
  default_recipient_role, requires_attorney_review, email_subject_template, body_template, notes) VALUES
 ('engagement_contract','Contingent Fee Contract (English — controls)','docx','contract','intake','matter_created','client',true,NULL,NULL,
   'Master: TEMPLATE_Contingent_Fee_Contract_EN.docx. Generates from sign-up minimums; merge fields client_full_name, case_type_label, incident_location, date_of_loss, today_date. English version controls. Executed status fires the sign-up checklist.'),
 ('engagement_contract_es','Contrato de Honorarios Contingentes (Spanish companion)','docx','contract','intake','matter_created','client',true,NULL,NULL,
   'Master: TEMPLATE_Contingent_Fee_Contract_ES.docx. Convenience translation for Spanish-preferring clients (person.preferred_language = es); ALWAYS issued together with the English version, which controls.'),
 ('lor_liability','Letter of Representation — Liability Carrier','docx','lor','intake','contract_signed','adjuster',false,NULL,NULL,'Master .docx to be provided'),
 ('lor_first_party','Letter of Representation — PIP/UM/MedPay (client''s carrier)','docx','lor','intake','contract_signed','adjuster',false,NULL,NULL,'Master .docx to be provided'),
 ('lop_provider','Letter of Protection','docx','lop','treating',NULL,'provider_records',true,NULL,NULL,'Attorney review before issuing an LOP'),
 ('hipaa_cover','HIPAA Authorization Cover Letter','docx','correspondence','intake','contract_signed','client',false,NULL,NULL,NULL),
 ('records_request','Medical Records & Billing Request','docx','correspondence','records',NULL,'provider_records',false,NULL,NULL,NULL),
 ('aff18001_request','CPRC 18.001 Affidavit Request','docx','correspondence','records',NULL,'provider_records',false,NULL,NULL,NULL),
 ('preservation_letter','Spoliation / Evidence Preservation Letter','docx','preservation_letter','intake',NULL,'opposing_counsel',true,NULL,NULL,NULL),
 ('non_engagement','Non-Engagement Letter','docx','non_engagement',NULL,'intake_rejected','client',true,NULL,NULL,'Malpractice control — attorney review'),
 ('disbursement_sheet','Settlement Disbursement Statement','xlsx','settlement_statement','settlement','settlement_agreed','client',true,NULL,NULL,'Excel master; math mirrors finance.disbursement_statement'),
 ('foia_request','FOIA Request (federal agency)','docx','foia_request','intake',NULL,'government_agency',false,NULL,NULL,
   'Master .docx to be provided. Cite 5 U.S.C. 552; describe records ({{records_description}}, {{request_date_range}}); state requester category and fee limit; ask for electronic production.'),
 ('pia_request','Texas Public Information Act Request','docx','pia_request','intake',NULL,'government_agency',false,NULL,NULL,
   'Master .docx to be provided. Cite Tex. Gov''t Code ch. 552 to {{agency_name}}; describe records; note 10-business-day clock; request itemized fee estimate if over $40. Crash reports may be faster via TxDOT CR-3 purchase than PIA.'),
 ('dps_driving_record','TX DPS Driving Record Request (adverse driver)','docx','dps_driving_record','intake',NULL,'government_agency',false,NULL,NULL,
   'Master .docx to be provided. Request {{record_subject_name}} (DL {{record_subject_dl}}, DOB {{record_subject_dob}}); certified Type 3A for litigation use; state DPPA/Transp. Code ch. 730 permissible use (litigation / anticipation of litigation).'),
 ('email_mediator_availability','Email — Mediator Availability Request','email',NULL,'litigation',NULL,'mediator',false,
   'Mediation availability — {{matter_display_name}}',
   'Dear {{mediator_name}},' || chr(10) || chr(10) ||
   'We represent the plaintiff in {{matter_display_name}}'
   || ' (Cause No. {{cause_number}}, {{court_name}}). The parties would like to'
   || ' schedule mediation and are checking your availability over the next'
   || ' 30-60 days. Please send available dates at your convenience.' || chr(10) || chr(10) ||
   'Thank you,' || chr(10) || '{{case_manager_name}}' || chr(10) || '{{firm_name}}',NULL),
 ('email_adjuster_callback','Email — Adjuster Callback Request','email',NULL,NULL,NULL,'adjuster',false,
   'Call requested — Claim {{claim_number}} / {{client_full_name}}',
   'Dear {{adjuster_name}},' || chr(10) || chr(10) ||
   'This firm represents {{client_full_name}} regarding claim {{claim_number}}'
   || ' (date of loss {{date_of_loss}}). Please call our office at your earliest'
   || ' convenience regarding this claim.' || chr(10) || chr(10) ||
   'Regards,' || chr(10) || '{{case_manager_name}}' || chr(10) || '{{firm_name}}',NULL),
 ('email_records_followup','Email — Records Request Follow-Up','email',NULL,'records',NULL,'provider_records',false,
   'Follow-up: records request for {{client_full_name}} (DOB {{client_dob}})',
   'Hello,' || chr(10) || chr(10) ||
   'We are following up on our request for records and billing for'
   || ' {{client_full_name}} (DOB {{client_dob}}), treatment dates'
   || ' {{treatment_date_range}}. Please advise on status.' || chr(10) || chr(10) ||
   'Thank you,' || chr(10) || '{{case_manager_name}}' || chr(10) || '{{firm_name}}',NULL);

-- Firm trust account placeholder
INSERT INTO finance.trust_account (label, bank_name, account_last4, iolta)
VALUES ('Tuttle Law Firm IOLTA', 'TBD — enter bank', NULL, true);
