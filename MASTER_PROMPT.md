# TUTTLE OS — MASTER BUILD PROMPT FOR CURSOR AI

You are building **Tuttle OS**: the complete practice-management web application for Tuttle Law Firm (d/b/a Crash Guy Injury Attorneys), a Texas personal-injury firm in San Antonio. The database is **finished, tested, and shipped** — it lives in `sql/` in this repo. The clickable HTML mockups in `mockups/` are the **functional specification**: they were built feature-by-feature with the firm's owner and every behavior in them is an approved requirement. Your job is to turn that database + those mockups into a production web app.

Read this entire file before writing any code. When this file, the mockups, and `docs/ui-design-decisions.md` disagree, `docs/ui-design-decisions.md` wins — it is the owner's decision log.

---

## 0. PRIME DIRECTIVES (never violate these)

1. **The database is the source of truth and the enforcement layer.** Security, validation, deadline computation, and task generation happen in Postgres. The UI displays state and captures input. NEVER re-implement or bypass: RLS policies, audit triggers, the deadline engine, the 18.001 engine, checklist generation, or soft-delete rules. If the DB rejects a write, surface the error — do not work around it.
2. **Column names are the API.** Supabase generates endpoints from the schema. Never rename database objects. New columns/tables must follow the Naming Standard (§3). Schema changes only via new numbered migration files in `sql/` style (with rollback), never edits to shipped files.
3. **No hard deletes, ever.** Every "delete" in the UI is a soft delete (`deleted_at`). Every list query filters `deleted_at IS NULL`.
4. **Every write has an actor.** Auth flows through Supabase Auth; `core.staff.auth_user_id` links the JWT to the staff row; the DB's `app.*` helpers resolve identity. Writes without a resolvable actor fail loudly by design.
5. **Legal-deadline math lives in the database.** The UI may format dates; it must never compute a legal deadline client-side and store it. Where the mockups computed dates in JS (they are mockups), implement the computation as a DB function/trigger following the patterns in `upgrade_v2.4_18001_engine.sql` (e.g., TRCP 99 answer-due on service entry).
6. **Fictional data only in seeds/fixtures.** Real client data enters only via the CasePeer migration pipeline (`sql/migration/`), which the owner runs deliberately. Dev seeds mirror the mockup characters (Delgado, Okafor, Ibarra…).
7. **Attorney-verify is sacred.** Any computed legal date carries its ATTORNEY-VERIFY flag through to the UI. Never present a rule-computed date as authoritative.

## 1. STACK (fixed — do not substitute)

- **Next.js 14+ (App Router) + TypeScript + Tailwind CSS**, deployed on Vercel.
- **Supabase**: Postgres (this schema), Auth (email + MFA), auto-generated REST via supabase-js, Realtime for live queue/task updates, Storage (Phase 8).
- **TanStack Query** for server state; React Hook Form + Zod for forms (Zod schemas mirror DB constraints — generate types with `supabase gen types typescript`).
- **Playwright** for e2e tests; **Vitest** for units.
- Dates: **date-fns**. Display format everywhere: `MM/DD/YYYY` (e.g., `07/14/2026`) — day, month, AND year on every displayed date; timestamps as `07/14/2026, 3:15 PM`. Entry fields use `MM/DD/YYYY` (not browser-locale `type=date`). Storage remains ISO `yyyy-MM-dd`. Owner rule #16 (year always present); US firm convention MM/DD/YYYY.
- **Theming: design tokens only.** All colors/fonts/radii live in ONE theme file (CSS variables consumed by Tailwind config). Default theme = "Parchment" (extract the exact values from any mockup's `:root` block). Also implement "Midnight" dark mode from `mockups/theme-preview-mockup.html`. No hard-coded colors anywhere in components. Status semantics are theme-invariant: red = jurisdictional/overdue, amber = watch, green = done, blue = informational/court-order — always icon + label, never color alone.

## 2. DATABASE SETUP (do this first, in this exact order)

Create a Supabase project, then run in the SQL editor / via migration tooling:

1. `sql/01_schema_v2.0.sql` — full base schema (12 schemas, ref data, workflow docs embedded).
2. `sql/02_upgrade_v2.1.sql` — hardening: RESTRICT cascades, soft delete, audit w/ mandatory actor, `app.*` auth helpers, SOL engine, RLS tiers, touch triggers, FK indexes, sign-up checklist generation, completion provenance, adjuster roster/notes, mediation intel, phone normalization (US+MX), LOR auto-complete, role-gap view.
3. `sql/03_upgrade_v2.3_f1_fix.sql` — drops a duplicate column (v2.2 was optional/skipped in numbering; see §8).
4. `sql/04_upgrade_v2.4_18001_engine.sql` — § 18.001 per-defendant clocks + DCO supersession.
5. `sql/05_upgrade_v2.5_naming.sql` — the naming-standard sweep (56 renames, functions/views updated).
6. Expose schemas to the API (Supabase Dashboard → API settings): `core, intake, medical, insurance, litigation, property, resolution, liens, finance, workflow, ref, analytics`. Grant usage per the scripts (role `app_staff` maps to `authenticated`; add `GRANT app_staff TO authenticated;`).
7. Create staff auth users; set each `core.staff.auth_user_id` to the Supabase Auth UUID. **Roles come from `core.staff.role_code`** (`ref.staff_role`): attorney, senior_paralegal, litigation_paralegal, case_manager, intake, demand_writer, lien_disbursement, admin — plus capability flags (`is_attorney`, `can_approve_level`, `can_clear_conflicts`).
8. Verify with `sql/tests/test_v2.5_battery.sql` (14 behavior tests must pass) before writing any frontend code.

**RLS tiers you can rely on (never re-check in the UI, but DO shape nav/screens around them):** all active staff read all cases; **intake** is DB-blocked from medical/litigation/resolution/liens/insurance/property; **finance detail** = attorney + lien_disbursement; **discovery content** = attorney + litigation_paralegal; conflicts cleared only by `can_clear_conflicts`. Locked nav shows 🔒 + tooltip naming the enforcing tier.

## 3. NAMING STANDARD (for any new objects — full text in `docs/DESIGN_NOTES.md`)

`_at` timestamptz system moment · `_date` calendar fact · `_due` date WE act by · `_deadline` court-imposed · `<verb>_by` staff actor · `owner_staff_id`/`author_staff_id` role-holders · bare-adjective booleans (`is_`/`can_` only when ambiguous) · `notes` freeform · `description` long text · `label` ref display · tables singular, PK `<table>_id` · ref tables `code`+`label`(+`category`) · `supersedes_<x>_id` points backward · views `v_*` · `staging.*` is CasePeer vocabulary, never touch.

## 4. APPLICATION SHELL

- **One app, role-based workspaces.** After login, route by `staff.role_code`: `/intake`, `/cases` (case manager), `/litigation` (paralegal), `/owner` (attorney/Michael), plus placeholders `/demands` (Kate), `/liens` (Emily), `/review` (Daniel) — see §7 Phase 7.
- **Global search on EVERY screen** (owner rule #0): sticky top bar; autocompletes clients showing DOI to disambiguate; searches name/phone/email/claim #/cause #/CasePeer id; matching is PARTIAL and phone-digit-normalized (`phone_e164` backing); Enter without selection → full results page grouped by category; results respect RLS automatically.
- **Every case shows CM + paralegal** on every row/header, everywhere. Missing assignment renders red `UNASSIGNED` (never blocks) and appears on the owner dashboard via `core.v_matter_role_gaps`.
- **Focus view by default** on case pages (owner rule #14): a "🎯 Needs you now" strip (overdue/red items, due calls, open checklist count, companion links) then every card collapsed to its one-line header; cards auto-open when hot (red status or open form); header click toggles; "🗂 Full view" restores everything-open.
- **No dead-end status** (owner rule #12a): every status badge/chip/timeline-node is a link that scrolls-to + expands its section (flash highlight); when the target doesn't exist, the click explains why (e.g., "Lien detail lives in the Lien & Disbursement workspace — restricted tier"). Intake gate items focus their exact form field.
- **My Activity for every user** (rule #10): their slice of the audit stream, newest first, "⟵ you left off here" + Resume.
- **Client-call follow-up dispatcher on every case header for every user** (rule #11): what-they-need* → routes to primary owner, teammate auto-sees it tagged `backup — primary: X`; logs to communication_log + case note.
- **My Tasks for every role** (rule #7a) + **"➕ Task for a co-worker (or me)"** everywhere (writes `workflow.task`, owner = assignee, created_by = sender, "from X" chip, sender sees completion in Activity).

## 5. THE TWO ENGINES (read before building any litigation screen)

**Deadlines (`workflow.deadline`) = WHEN.** Sources ranked `court_order > agreement > rule > manual`; statuses pending/satisfied/missed/extended/vacated/n_a; vacated rows keep `adjusted_reason`. Feeds: case Deadlines card, Deadline Horizon (45d, JX = jurisdictional badge, overdue pinned red — never age off silently), owner SOL watch. **Every deadline row syncs to the firm calendar** (Phase 9 — Microsoft Graph AND Google Calendar adapters; adds, moves, vacaturs push automatically).

**Tasks (`workflow.task`) = WHO does WHAT.** Completion provenance: `system` (data proved it) / `manual` / `manual_override` (+ required `override_reason`; overrides feed `workflow.v_task_override_patterns` on the owner dashboard). Document-backed tasks complete themselves when the document lands — never ask a human to confirm what the record proves (rule #6).

**Task CHAINS (rule #7b-i) — implement as DB machinery** (new migration: `ref.task_chain_step` + completion/data-event triggers, modeled on the contract-checklist generator): each completion spawns the next link; only the currently-actionable step exists. **The service chain** (fully specified + demonstrated in the paralegal mockup): FILED → per-defendant "Request citation" → "Confirm citation received" (ages) → "Forward to process server" → 5-day follow-up that RESPAWNS (attempt #N) until the return-of-service entry kills the loop (system) and spawns "Confirm answer filed (TRCP 99 due X)" → answer entry completes it → disclosure-prep template. **Multi-defendant:** one chain per defendant; a per-case **service coverage board** in My Tasks audits the roster — "⚠ CHAIN STALLED" and "🛑 NO CHAIN — citation never requested" flags with one-click restart. Stage templates likewise: first answer → disclosure prep; DCO mediation date → mediator selection; depo scheduled → readiness checklist; trial <120d → trial prep.

## 6. FORM → TABLE MAP (every input in the mockups, where it writes, what it fires)

| UI form (mockup) | Writes | Fires (already in DB unless noted) |
|---|---|---|
| Intake lead (six-minimums gate; structured name First*/Middle/Last*/Suffix/Goes-by; phone US🇺🇸/MX🇲🇽 format-as-you-type, 10-digit gate, E.164 storage; in-person waives email only, audit-logged) | `core.intake_lead`, `core.person` | est. SOL preview on DOI entry; rejection incomplete until non-engagement letter |
| Contract executed (document status → `executed`) | `workflow.document` | 9-task bilingual-guarded sign-up checklist; viability review +7d; matter opens |
| Checklist item complete | `workflow.task` | doc-backed items require the document OR an override with reason |
| Open DINSCO/PINSCO claim; **LOR sent date (required — generated ≠ sent)** | `insurance.claim` | `lor_sent_date` completes the matching LOR task (system); PINSCO refusal documented → PINSCO tasks waived, amber not green |
| Adjuster roster (BI/PD/PIP/UM-UIM/litigation/supervisor per claim) + 💬 cross-case adjuster notes | `insurance.claim_adjuster`, `insurance.adjuster_note` | roster view `v_claim_adjuster_roster`; firm-wide history per adjuster |
| PD two-step (vehicle facts w/ source client-call/CR-3, location = storage clock; route DINSCO PD vs PINSCO collision — refusal disables PINSCO route) | `property.vehicle`, `property.pd_claim`, `insurance.claim` | last_touch stamps; PD aging; demand blocker at demand stage |
| Treatment coverage boxes (every category answered: provider(s) or explicit N/A) + episodes; repeat visits (+visit → records-supplement flag if request predates) | `medical.treatment_episode`, clinical events | unanswered boxes red ☐; ambulance-miss = surprise lien warning |
| New-provider intake (**three address types**: 🏢 business* / 💵 remit (unless same) / 📍 0..N treatment locations; records method; accepts-LOP) | `medical.provider` + labeled `contact_point` rows | LOP flag → attorney queue |
| Provider call log (reached?; status incl. gap/noncompliant → immediate escalation; balance; next appt; **ESI and MBB as separate multi-region procedures** (lumbar/cervical/thoracic/other+text); **MRI once-per-body-part, done parts LOCKED with real date**; per-procedure optional dates else "(rptd)"; initial-visit date until on file) | `medical.provider_contact_log`, clinical events, treatment log | +14d self-schedule (no-answer ≈ 2d retry); RingCentral duration when dialed from card |
| Service attempt (date+time*, address*, by*, outcome, narrative* — "a judge reads THIS", photo notation, next step) | `litigation.service_attempt` | tolling/diligence record; Rule 106 exhibit; outcome=SERVED hands off to return form |
| Return of service (date*, method, return-saved* + clerk-filing note TRCP 107(h)) | `litigation.service_of_process` | **implement in DB:** TRCP 99 answer-due computation + docket + calendar; kills service-chain loop; spawns confirm-answer; overdue → 🔔 default-window flags everywhere (check-clerk caution) |
| Answer entry (date*, counsel, doc*) | `litigation.lit_party.answer_filed_date` | v2.4 trigger: per-defendant 18.001 serve-90/counter-120 clocks (court-ordered date suppresses new serve clocks); first answer: 194.2(a) disclosures + provisional L2 close + 18-mo appearance trial target (Bexar practice); vacates TRCP 99 row; completes chain step |
| Scheduling order (11 standard fields + editable ¶ cites + custom rows; **18.001 selector: same-day-as-experts / own date / silent**; order-saved* gate; amended = warns + vacates prior court-order rows) | `litigation.scheduling_order` → `apply_scheduling_order()` | vacates superseded rule rows; dockets court dates; 18.001 supersession per selector; mediation card creation; **court-scoped local rules: Bexar 225th 45-day DCO-due satisfied** |
| Mediation (candidates by/agreed; availability email from template; select & schedule; ⚡ early/voluntary override pre-DCO) | `litigation.mediation`, `mediation_candidate` | mediator intel: `v_mediator_carrier_history` (low-settle warnings), `v_mediator_defense_history` |
| Task assign / follow-up dispatcher | `workflow.task`, `communication_log` | see §4/§5 |
| To Be Filed → "FILED" (cause #, court, filed date) | `litigation.court_case` | court-scoped local-rule templates arm (225th 45-day DCO row); per-defendant service chains start |

Paralegal case pages additionally render: the **17-node pizza-tracker timeline** (every node derived live from the record, per-defendant branches on Service/Answers, YOU ARE HERE on first incomplete, settlement-exit-ramp footer), per-defendant boxes (served+answered collapse), discovery table w/ deficiency pipeline (10-day letter → conferral → MTC), Plaintiffs block for co-plaintiff cases, county/court rules line. Companion cases (multi-plaintiff crashes): `incident_group` badge "👪 N of M · same crash", companion strip w/ roles, conflict-waiver chip (red pending = NO cross-file sharing), copy-sharing, shared-vs-never-shared ledger incl. **aggregate-limits warning**, minor handling (next friend, SOL ⚠ ATTORNEY-VERIFY, friendly-suit flag). Workspace switcher: paralegals get the FULL CM workspace via persistent top-bar toggle both directions, identity banner, audits as themselves; CMs get milestones-only litigation view.

## 7. BUILD PHASES (do them in order; each phase ends with passing Playwright tests)

1. **Foundation**: Supabase setup (§2), auth + staff linking, app shell, theme tokens, role routing, global search, generated TS types.
2. **Intake workspace** — `mockups/intake-workspace-mockup.html`.
3. **Case Manager workspace** — `mockups/case-manager-workspace-mockup.html` (largest; every card/form in §6).
4. **Litigation Paralegal workspace** — `mockups/litigation-paralegal-workspace-mockup.html` (queues, timeline, chains + coverage board, My Tasks, DCO/service/answer forms). Includes the task-chain DB migration.
5. **Owner dashboard** — `mockups/owner-dashboard-mockup.html` (stalled cases w/ flag filters, approvals, SOL watch, 7-day reviews, conflicts, override patterns).
6. **Cross-workspace**: switcher, companion cases polish, notifications.
7. **Remaining workspaces** (Demand Writer / Lien-Disbursement / Senior Reviewer): schema support exists (resolution.*, liens.*, viability/approvals). NO mockups yet — build data-complete skeleton pages, then STOP and present screen proposals to the owner before detailing. Do not invent workflow here.
8. **Documents + AI** (optional layer, owner-gated): apply `sql/optional/06_upgrade_v2.2_documents.sql` then `07_upgrade_v2.6_documents_ai.sql`; private `case-documents` bucket w/ policies from the script comments; upload panel + per-doc 🤖 status + case-wide full-text search + Summarize/Extract actions per `mockups/document-upload-mockup.html`; worker per `docs/documents-feature-review.md` (queue claim via `workflow.claim_ai_job`; 3 strikes → loud failed). ⚠ **Do not process real medical records until the owner confirms BAAs (OCR vendor + Claude API).**
9. **Calendar sync**: adapter interface with Microsoft Graph + Google Calendar implementations; every `workflow.deadline` add/move/vacatur pushes; org-configurable.
10. **CasePeer migration**: `sql/migration/` pipeline (owner runs it; CSVs live in the firm's Dropbox, NOT in this repo — they contain real client data).

## 8. REPO ORIENTATION

`sql/` numbered = applied order. `sql/optional/` = v2.2/v2.6 drafts (Phase 8). `sql/rollbacks/` = tested reversals (v2.2/2.3/2.4/2.5/2.6). `sql/tests/` = behavior batteries (`test_v2.4_18001.sql` targets pre-rename names — historical; use `test_v2.5_battery.sql`). `sql/migration/` = CasePeer pipeline (`migrate_v2.5.sql` is current; `migrate.sql` pre-rename historical). `docs/ui-design-decisions.md` = **the owner's rulebook — read fully before Phase 2**. `docs/schema-overview-for-designer.md` = orientation. `docs/DESIGN_NOTES.md` = naming standard + firm design notes. `docs/field-name-consistency-review.md`, `docs/documents-feature-review.md` = history/rationale. `mockups/*.html` = open in a browser; every button works; replicate behavior, not markup.

## 9. TESTING BAR (non-negotiable)

- Playwright e2e per phase reproducing the mockup behaviors (the mockups were themselves verified by headless test batteries — match that bar). Case-insensitive text assertions (CSS uppercasing).
- RLS tests per role: intake blocked from medical (row AND API), finance tier, discovery tier.
- DB behavior tests stay green (`test_v2.5_battery.sql`) after every migration you add.
- Date rendering test: no year-less date anywhere.
- Every new migration ships with a tested rollback, applied to a scratch branch/db first. Nothing goes to the real project untested.

## 10. WHEN UNSURE

If the mockups and this prompt don't answer a question, check `docs/ui-design-decisions.md`. If still unanswered, add the smallest reasonable implementation behind a clearly-marked `// OWNER-DECISION-NEEDED:` comment and list it in a running `DECISIONS_NEEDED.md` at repo root for the owner (Michael) — do not silently invent workflow, and do not block the build.
