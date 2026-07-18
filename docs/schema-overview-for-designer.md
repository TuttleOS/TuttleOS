# Tuttle OS — Database Schema Overview (for design discussions)

**One-liner:** a PostgreSQL/Supabase database for a Texas personal-injury practice — 96 tables in 12 domains — where the database itself enforces security, computes deadlines, and generates work. The UI never invents state; it displays and captures it. **Column names are the API** (Supabase auto-generates endpoints from them), so the naming standard below is a UI contract, not trivia.

**Current version: v2.5 applied.** (v2.2 file-storage and v2.6 AI-document layers are drafted and tested but deliberately not adopted yet.)

---

## The spine — how everything hangs together

```
person / organization          (people and companies, reused everywhere)
        │
incident_group                 (ONE crash — the event)
        │ 1:N
client_matter                  (ONE CLIENT's case from that crash — own SOL,
        │                       own medicals, own settlement; companion cases
        │                       = sibling matters on the same incident_group)
        ├── insurance.*        claims (DINSCO/PINSCO), policies, adjuster roster per claim
        ├── medical.*          treatment episodes per provider, bills, records requests,
        │                       provider call log, clinical events, § 18.001 affidavits
        ├── property.*         vehicle + PD claim
        ├── litigation.*       court_case → lit_party (per defendant/plaintiff),
        │                       service, scheduling orders, discovery, depos,
        │                       mediation, experts, trial, judgment
        ├── resolution.*       demands, negotiation events, settlement, releases
        ├── liens.*            lien screen, liens, Medicare detail
        ├── finance.*          fee agreements, expenses, trust, disbursement
        └── workflow.*         tasks, deadlines, documents, notes, templates,
                                communication log, issue flags
```

Supporting domains: **ref** (11 lookup tables — every dropdown in the UI comes from a `code` + `label` ref table, never hard-coded), **audit** (immutable change log — every write records who/when/what), **analytics** (closed-case snapshots for the owner dashboard).

## Five things the designer should build around

**1. Security lives in the database, not the UI.** Row-Level Security tiers: all active staff see all cases; intake is database-blocked from medical/litigation/liens/resolution/insurance/property; financials = attorney + lien-disbursement only; discovery work product = attorney + litigation paralegal. The UI shows locked nav with 🔒 + tooltip; it never has to police anything itself.

**2. The database generates the work.** Events fire automation: an executed contract creates the 9-task sign-up checklist; entering a defendant's answer starts that defendant's § 18.001 clocks; a scheduling order vacates the statutory deadlines it supersedes and dockets the court's dates; service entry computes the TRCP 99 answer deadline. Two engines matter for UI: **workflow.deadline** (WHEN — court/statutory dates, sources ranked court_order > agreement > rule, vacated rows keep their reason) and **workflow.task** (WHO does WHAT — owners, assigners, completion provenance: system / manual / manual_override with required reason). Task *chains* spawn the next step on completion, per defendant.

**3. Everything is soft-delete + audited.** No hard deletes anywhere. Every table carries `created_at / updated_at / deleted_at`. Writes without an identified actor are rejected loudly. Design implication: "delete" in the UI is always "archive," and history views are cheap.

**4. Statuses are controlled vocabularies.** Task status, deadline status (pending/satisfied/missed/extended/vacated/n_a), document lifecycle (needed→requested→drafted→sent→received→executed→filed), matter stages — all CHECK-constrained. UI status chips map 1:1 to these values; icon + label always, never color alone.

**5. Naming standard (= API contract).** Tables singular; PK `<table>_id`. Dates: `_at` = timestamp (system moment), `_date` = calendar fact (`answer_filed_date`), `_due` = date we must act by, `_deadline` = court-imposed. People: `<verb>_by` = who did it, `owner_staff_id` = who owns it. Booleans are bare adjectives (`drivable`, `court_ordered`). `notes` = freeform everywhere; `label` = ref display text; `phone_e164` = normalized phones; `casepeer_*` = legacy crosswalks.

## Numbers worth knowing

12 schemas · 96 tables · ~1,470 columns · 30+ views (all `v_*`, e.g. v_sol_reconciliation, v_stalled_cases, v_matter_role_gaps) · 39 functions/triggers · 770 real cases migrated from CasePeer for testing. Multi-defendant and multi-plaintiff are first-class: `lit_party` rows per party per case, per-defendant deadline clocks, companion matters per crash.

## What's designed but intentionally parked

- **v2.2 documents**: files in Supabase Storage, metadata on `workflow.document` (42 doc types), signed-URL viewing, per-category RLS, version chains.
- **v2.6 AI layer**: full-page OCR text, AI descriptions/extraction, processing queue, case-wide full-text search, optional semantic search.
Both have tested rollbacks; adopting is two scripts.

## Where to see it working

Clickable mockups (Dropbox → `0 Tuttle OS/UI Mockups/`): intake, case manager, litigation paralegal, owner dashboard, document upload demo, theme preview. The design rulebook — every decision Michael has made, numbered — is `ui-design-decisions.md` (universal rules: global search on every screen, every status is a clickable link to its section, Focus view/progressive disclosure, day-month-year on every date, every case shows its CM + paralegal, no dead-end status).
