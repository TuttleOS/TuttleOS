# Tuttle Law Firm — Practice Management Database
## Design Notes & Build Guide (v1.1 — July 6, 2026)

Companion to `schema.sql` (PostgreSQL 16+, 85 tables, 6 dashboard views,
validated end-to-end against a live Postgres instance; 32-test suite passing).

> **v1.1** — independent review pass; see `SCHEMA_REVIEW_2026-07-06.md`.
> Deadline engine corrected (TRCP 99 Monday-next, backward-count rolling,
> true month/year units per Gov't Code 311.014), trust void loophole closed,
> audit log made physically immutable, and added: `core.liability_assessment`,
> `liens.lien_screen`, document-type seeds, PD aging view, health policy type,
> `court_case.case_kind` (Rule 202 / friendly suit), wider entity registry.
> Multi-defendant support: per-defendant deadlines attach to `lit_party`,
> per-defendant 18.001 windows (`litigation.affidavit_18001_party`), and
> court-entered scheduling orders (`litigation.scheduling_order` +
> `apply_scheduling_order()`) that supersede rule-based defaults.
> Later additions: per-defendant negotiation/settlement links, type-ahead
> search (pg_trgm indexes + `core.quick_search()`), optional server contact
> link on service attempts, and the template module (`workflow.template`,
> `merge_field`, `template_merge_field`, `generated_document`) — versioned
> Word/Excel/email templates with a merge-field dictionary and a frozen
> merge-data audit log; 15 starter templates and 34 merge fields seeded.
>
> **v2.0 final session additions (93 tables):** sign-up gate (5 minimums incl.
> injury location cascade + in-person email override) with contract-signature
> automation; FOIA / TX PIA / DPS driving-record tracking with dedicated
> badges; semantic search (`workflow.embedding`, pgvector); PM-call clinical
> checklist (initial visit, MRI referral + destination, TPI/ESI/MBB by region,
> RFA rec/complete, surgical referral) tied to the reporting call; per-injury
> TBI flag carried through the dashboard; E.164 phone normalization +
> click-to-call attribution (matter + claim bound at click) + inbound call
> triage queue (`v_comms_needing_matter`); adjuster extensions and
> `handling_unit` for group-worked claims; middle names in search and merge
> fields; gender/race/deceased on person; case age from SIGN-UP + days-in-stage
> on the dashboard and `analytics.v_stage_velocity` (the lifespan instrument).
> Deliberately rejected: dollar-value estimates/projected funding (Levels are
> the value proxy that triggers action).

---

## 1. What this is

A full relational data model for a Texas plaintiff's PI practice, covering
intake → pre-litigation → litigation → settlement → disbursement → closed-case
analytics. It implements the Incident Group / Client Matter architecture from
your July 5 planning documents and extends it with a complete litigation
module, financials (trust/IOLTA, expenses, fee splits), and a Texas deadline
engine.

Load it with:

```bash
createdb tuttle
psql -d tuttle -f schema.sql
```

## 2. Schema map

| Schema | Contents |
|---|---|
| `ref` | Lookup tables + seeds: stages, party roles, lien types, expense categories, clinical events, courts, holidays, **Texas deadline rules** |
| `core` | person, organization, contact_point, staff, intake_lead, **incident_group**, **client_matter**, matter_party, representation_link, staff_assignment, stage_history, conflict_check, limitations_analysis |
| `workflow` | issue_flag, task, deadline + **compute_deadline()**, document, note + copy-block, communication_log, decision_log, viability_review |
| `insurance` | policy, claim (incident- or matter-scoped), coverage_assessment (the Level inputs) |
| `medical` | provider, treatment_episode, provider_contact_log (auto-schedules next bi-weekly call), injury, clinical_event, record_request, bill, affidavit_18001, wage_loss |
| `property` | vehicle, pd_claim |
| `liens` | lien, medicare_detail, lien_event |
| `resolution` | demand (Stowers fields), negotiation_event, settlement (minor-settlement controls), settlement_release |
| `litigation` | court_case (TRCP 190 levels, removal/remand, HB 19), lit_party, service_of_process + service_attempt (diligence log), filing, discovery_set, **discovery_request** (per-request deficiency tracking), production (Bates), deposition, expert, motion, hearing, mediation, trial_setting, trial_witness, exhibit, depo_designation, judgment |
| `finance` | fee_agreement (tiered contingency), fee_split (TDRPC 1.04(f)), case_expense, trust_account, trust_transaction (overdraft-blocked), disbursement_statement (math-checked), disbursement_line |
| `audit` | change_log — immutable row-level history with who/when, via generic trigger |
| `analytics` | closed_case_snapshot + finalize_matter_close() — your future valuation dataset |

## 3. The five load-bearing design patterns

**Entity registry (`core.entity`).** Tasks, notes, documents, issue flags,
deadlines, and decisions can attach to *anything* — a matter, a deposition, a
lien — with real foreign-key integrity. Every major table auto-registers its
rows via trigger (`core.instrument_table()` wires this up). This is what makes
"one universal task system" possible instead of per-module task tables.

**Exclusive arcs.** Where something belongs to X *or* Y (a claim on the
incident vs. on one client's matter; a contact point on a person vs. an org),
both FK columns exist with a `CHECK (num_nonnulls(...) = 1)`. Postgres
enforces it; Airtable never could.

**Derived, never stored.** Display names (`Doe, John - 2026.05.01 +1`) come
from `core.matter_display_name()` at query time — they can't go stale when a
linked client is added. Trust balances come from `finance.matter_trust_balance()`.
If a fact can be computed, it is computed.

**Enforced authority.** `approved_level` can only be changed by staff with
`can_approve_level` (trigger-enforced via the `app.staff_id` session variable —
in Supabase, swap this for a JWT claim). Cross-matter note copying is blocked
until the pairwise `representation_link` shows clearance. The trust ledger
refuses disbursements exceeding a matter's balance. The disbursement statement
has a CHECK constraint forcing the math to balance. These are rules the
database itself will not let anyone break.

**History, not overwrites.** `stage_history` (with an exclusion constraint
guaranteeing exactly one open stage), `staff_assignment` (one active holder
per role, prior assignments preserved), `audit.change_log` (every change to
consequential tables: who, when, old row, new row), `workflow.decision_log`
(business decisions: Level approvals, conflict clearances, file-suit calls).
Between these, you can reconstruct any file's story — a malpractice defense
asset as much as a management tool.

## 4. The Texas deadline engine

`ref.deadline_rule` + `workflow.compute_deadline(rule, base_date, served_by_mail)`
encode deadline math as data: day counts, calendar vs. business days,
TRCP 4 weekend/holiday rolling, the TRCP 99 "Monday next after 20 days"
rule, and the TRCP 21a three-day mail extension. Sixteen starter rules are
seeded with citations (limitations, TTCA notice, answer dates, discovery
responses, 194 initial disclosures, MSJ notice/response, expert designations,
MNT/appeal, removal/remand, Chapter 74, errata). Negative day counts count
backward from a base (e.g., expert designation −90 from discovery-period end).

**Every seeded rule is marked attorney-verify-before-reliance.** Rules change
(the 2021 TRCP amendments being the obvious example), city charters shorten
TTCA notice, and county practice varies. The engine is sound; the rule
contents are yours to own. Populate `ref.court_holiday` annually.

## 5. Decisions you asked me to make (and why)

- **Discovery at the individual request level.** `discovery_set` holds the
  set-level dates; `discovery_request` holds each ROG/RFP/RFA with response,
  objections, `will_supplement` status, and a deficiency pipeline
  (deficient → letter → conferred → MTC → ruling). This mirrors — and can
  eventually feed — your production-analysis skills; `litigation.production`
  tracks Bates ranges and links to the analysis document.
- **Full financials.** Trust ledger with per-matter balance protection and
  reconciliation tagging; tiered contingency fee agreements; fee splits with
  the 1.04(f) disclosure/consent paper trail; case expenses linked to record
  requests and disbursement lines. `disbursement_statement` won't accept rows
  where gross − fees − expenses − liens ≠ net.
- **Documents are metadata.** Bytes stay in Dropbox/CasePeer;
  `workflow.document` stores type, status workflow, paths, Bates, and
  follow-up dates. `casepeer_case_id` on the matter keys the two systems.
- **Mediation attaches to matter OR case** (exclusive arc) because you
  mediate pre-suit too.
- **A matter can have multiple court_cases** (nonsuit/refile, intervention),
  and `lit_party` supports CPRC 33.004 responsible-third-party designations.
- **Service diligence is first-class.** `service_of_process` +
  `service_attempt` exist specifically because diligence-in-service is a
  limitations battleground — every attempt is a dated, documented row.

## 6. What the smoke test proved (all passing)

1. Display name derives with correct `+N` for linked matters
2. A Case Manager attempting to set `approved_level` is rejected by the DB
3. An authorized approver succeeds and is auto-stamped as approver
4. Cross-matter note copy is blocked before conflict clearance…
5. …and flows after clearance + copy permission
6. Logging a provider call auto-creates the next bi-weekly task and updates the episode's balance snapshot
7. Trust disbursement with insufficient matter balance is refused; deposit-then-disburse works
8. TRCP 99 answer date computes correctly (Monday-next rule)
9. Mail service adds the 21a three days
10. The stalled-case dashboard view runs with live flags
11. The audit log captured the Level change with actor attribution

## 7. Build roadmap (suggested)

1. **Host**: Supabase (managed Postgres + auth + RLS + auto-API). Sign their
   BAA — this database holds PHI. Map `app.staff_id` to the JWT claim.
2. **Load** `schema.sql`; enter real staff, courts, and the trust account row.
3. **RLS pass**: enable row-level security per role (the schema's
   trigger-based guards are the floor, not the ceiling).
4. **First screens** (Retool/Appsmith or a Claude Code app), in value order:
   intake + conflict check → Case Profile / 7-day review → the one-tap
   provider-call logger → stalled-case dashboard → demand queue → Emily's
   lien worklist. The five `v_*` views are those dashboards, pre-written.
5. **Integrations**: nightly CasePeer sync keyed on `casepeer_case_id`;
   RingCentral call/SMS webhooks → `communication_log`; Plaud intake
   summaries → `note`.
6. **Deadline rules**: verify the 16 seeds, add your county-specific ones,
   load 2027 holidays each December.
7. **On close**: call `analytics.finalize_matter_close(matter_id)` — after
   a year you'll query settlement outcomes by Level, county, treatment
   profile, and marketing source.

## 8. Deliberately out of scope (add later without redesign)

Full user auth tables (Supabase provides), document full-text search
(pgvector/tsvector later), email ingestion, client portal, payroll/operating
accounting (keep in QuickBooks), and multi-firm tenancy. The registry +
schema-per-domain structure means each of these bolts on without touching
what's here.

---
*Confidential work product — Tuttle Law Firm. Deadline rule seeds require
attorney verification before reliance.*

---

## Naming Standard (adopted 2026-07-13 — v2.5 sweep applied; every future column follows this)

**Time columns — four suffixes, four meanings, zero exceptions:**
- `_at` — timestamptz. A system moment (created_at, updated_at, level_approved_at).
- `_date` — date. A calendar fact (lor_sent_date, answer_filed_date, signed_date, served_date).
- `_due` — date. A date **we** must act by (response_due, follow_up_due, service_due).
- `_deadline` — date. A **court-imposed** outer limit (mediation_deadline, expert_challenge_deadline, pretrial_disclosures_deadline).
- Grandfathered legal/medical idioms (documented exceptions, do not extend): date_of_birth, date_of_death, date_of_loss; range endpoints `_from`/`_to`/`_start`/`_end`; `_as_of` snapshots; ref.court_holiday.holiday_date.

**People columns:**
- `<verb>_by` — the staff member who did the thing (approved_by, reviewed_by, logged_by, completed_by).
- `owner_staff_id` / `author_staff_id` — role-holders. Nothing else (no reviewer_id, no by_staff_id).

**Everything else (blessing what the schema already did):**
- Tables singular; PK `<table>_id`; ref.* lookups use `code` + `label` (+ `category`).
- Role-prefixed FKs state the role: carrier_org_id, holder_person_id, counsel_org_id.
- Booleans are bare adjectives (active, drivable, court_ordered); `is_`/`can_` only where the bare word is ambiguous (is_attorney, can_clear_conflicts).
- `notes` = universal freeform; `description` = the long-text field on work items (no `detail`); `title` = headline of a work item; `label` = ref display; `name` = proper noun.
- `supersedes_<thing>_id` points BACKWARD at what the new row replaces (immutable history). The two legacy forward `superseded_by` columns are documented exceptions pending a deliberate write-pattern decision.
- Views `v_*`; CasePeer crosswalks `casepeer_*`; phones `phone_e164`; money numeric with `_amount`/`_pct`.
- `staging.*` mirrors CasePeer export headers verbatim and is NEVER renamed.
- Party-labeled expert columns (expert_designation_plaintiff_date) keep DCO phrasing, but the 90-day track legally belongs to the party seeking affirmative relief (TRCP 195.2) — counterclaim caveat applies.

Applied by Tuttle_PM_Schema_v2.5_naming_APPLIED.sql (56 renames, 7 functions patched, 7 views rebuilt; rollback on file).
