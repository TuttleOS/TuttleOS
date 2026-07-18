# Tuttle OS — Field-Name Consistency Review

**Date:** July 13, 2026 · **Scope:** schema v2.1 as built — 96 base tables, 1,471 columns across 12 schemas (core, intake→workflow, medical, insurance, litigation, property, resolution, liens, finance, workflow, ref, analytics, audit). The `staging` schema is excluded — it deliberately mirrors CasePeer's export headers and should never be renamed.

**Nothing in this review has been changed. These are recommendations only.**

---

## The short answer

The naming is **better than most production databases** — there is clearly one mind behind it. The core conventions are strong and worth codifying as law. The problems cluster into a handful of families where two dialects grew up side by side (usually one in `workflow`/`core` and another in `litigation`/`insurance`), plus **one outright duplicate column that is a bug, not a style question**. Because no production app or API exists yet, every rename on this list is nearly free today — and 10× more expensive the day the UI ships, because Supabase generates the API directly from these names. Column names ARE the API contract.

---

## What is already consistent — keep it, write it down

These patterns hold across all 96 tables and should become the official style guide:

1. **Singular table names**, PK named `<table>_id` (uuid). The exceptions are principled: all `ref.*` lookup tables use a natural-key `code` + `label` (+ optional `category`) — uniform among themselves; junction tables use composite keys.
2. **`entity_id` anchor on every row** and `client_matter_id` on everything case-scoped. Uniform.
3. **The audit trio `created_at` / `updated_at` / `deleted_at`** (timestamptz) on essentially every base table. Uniform, and the v2.1 soft-delete/audit machinery depends on it.
4. **Role-prefixed foreign keys**: `carrier_org_id`, `holder_person_id`, `next_friend_person_id`, `counsel_org_id`, `vendor_org_id`, `deponent_person_id`. The FK name deliberately differs from the target PK to state the *role* — this is a feature, not an inconsistency.
5. **`casepeer_*` prefix** for every legacy crosswalk column; `phone_e164` for normalized phones; `notes` (plural, text) as the universal freeform field; `v_` prefix on all 30+ views, no exceptions found.
6. **Money is `numeric`** with `*_amount` / `*_pct` suffixes throughout finance/liens/medical.

---

## Findings — ranked, with suggested (unapplied) changes

### F1 · BUG: `litigation.scheduling_order` has the same deadline twice
`expert_challenge_deadline` **and** `challenge_expert_deadline` both exist in the table — same concept, two columns. Whichever one the app doesn't write will sit NULL forever and eventually someone will query the wrong one and conclude no Daubert deadline exists.
**Suggest:** drop `challenge_expert_deadline`, keep `expert_challenge_deadline` (matches the `<noun>_deadline` shape of its neighbors). This is the one change I would make *now* — both columns are empty, so it costs nothing today.

**Verified (Michael's question, 2026-07-13):** could the pair be intentional — e.g. separate challenge deadlines for P-experts vs D-experts, the way designations stagger? No: neither column is party-scoped (unlike `expert_designation_plaintiff`/`_defense`), neither is commented, and `litigation.apply_scheduling_order()` reads ONLY `expert_challenge_deadline` — the other is referenced by nothing anywhere in the database. True orphan/duplicate. Orders that DO stagger challenge deadlines per side are handled by custom deadline rows without schema change.

**Related nuance surfaced by the same question:** the 90-day designation track (`ref.deadline_rule` `expert_desig_p_90`, labeled "Plaintiff expert designation") is legally keyed to the **party seeking affirmative relief** (TRCP 195.2) — usually the plaintiff, but a counterclaiming defendant lands on the 90-day track too. Suggest keeping the plaintiff/defense column names (that's how DCOs read) but amending the rule LABEL to "Expert designation — party seeking affirmative relief (usually P)" and noting the counterclaim caveat in the style guide.

### F2 · The § 18.001 twins name the same three clocks differently
`medical.affidavit_18001` says `service_deadline`, `counter_deadline`, `served_date`.
`litigation.affidavit_18001_party` says `our_service_due`, `counter_affidavit_due`, `served_on_date`.
Same statute, same clocks, three naming decisions apart. A paralegal-facing report joining both will read like two different systems.
**Suggest:** one vocabulary across both: `served_date`, `service_due_date`, `counter_affidavit_due_date`, `counter_affidavit_received_date`. (Separately worth a design look: whether the per-episode and per-party tables should be one table with a party link — but that's structure, not naming, and out of scope per your instruction.)

### F3 · Deadline columns speak three dialects — sometimes in one table
`litigation.scheduling_order` alone contains `mediation_deadline` (…_deadline), `pretrial_disclosures_due` (…_due), `discovery_close` (bare), `trial_date` (…_date), and `expert_designation_plaintiff` (bare). Across the database: 7 `*_deadline` columns, 19 `*_due`, plus bare ones.
**Suggest a two-word rule:** `*_due` = a date by which *we* must act (answer_due, response_due, follow_up_due — already the majority); `*_deadline` = reserved for court-imposed outer limits if you want the distinction, otherwise fold into `_due`; everything else that holds a calendar date ends in `_date` (`discovery_close_date`, `expert_designation_plaintiff_date`). Whichever rule you pick matters less than picking one.

### F4 · Event dates: bare past-tense vs `*_date` — and one real type trap
`workflow.document` uses the suffixed family (`requested_date`, `sent_date`, `received_date`, `executed_date`). The litigation/insurance schemas use bare past-tense DATE columns — 36 of them: `lor_sent`, `citation_issued`, `citation_requested`, `answer_filed`, `notice_served`, `dec_sheet_received`, `preservation_letter_sent`… Readable in isolation; inconsistent as a system ("is `lor_sent` a boolean or a date?" is a question someone will ask).
The trap this dialect already produced: `insurance.claim_adjuster.started_at`/`ended_at` are **DATE** columns wearing the **timestamptz suffix** — while `core.staff_assignment.ended_at` is a true timestamptz. Same name, different types, guaranteed future bug.
**Suggest:** codify `_at` = timestamptz only, `_date` = date only. Rename the 36 bare event dates to `*_date` (`lor_sent_date`, `citation_issued_date`…), and `claim_adjuster.started_at/ended_at` → `start_date`/`end_date`. This is the biggest sweep on the list — decide it once, before the UI is generated.

### F5 · "Who did it" columns: one strong pattern, five stragglers
29 staff FKs use the excellent `<verb>_by` pattern (`approved_by`, `reviewed_by`, `drafted_by`, `completed_by`, `screened_by`…), and `owner_staff_id`/`author_staff_id` are defensible role-FKs. The stragglers: `liens.lien_event.by_staff_id` (reads like a typo), `workflow.viability_review.reviewer_id` (its own sibling column is `prepared_by`), `insurance.coverage_assessment.coverage_followup_owner` (redundant prefix, hides that it's staff), and `workflow.task.escalated_to` (fine to read, but the only "to" in the system).
**Suggest:** `by_staff_id` → `logged_by`; `reviewer_id` → `reviewed_by`; `coverage_followup_owner` → `followup_owner_staff_id`; leave `escalated_to` and `owner_staff_id`/`author_staff_id` as documented patterns.

### F6 · Supersede columns point in opposite directions with near-identical names
`litigation.scheduling_order.supersedes_order_id` points **backward** at the order it replaces (new row carries the pointer — old rows immutable). `finance.fee_agreement.superseded_by` and `workflow.deadline.superseded_by` point **forward** at the replacement (requires UPDATING the old row). Two mental models one letter apart.
**Suggest:** standardize on the backward `supersedes_<thing>_id` direction (immutable history; also what the v2.2 documents draft uses) and rename/flip the two `superseded_by` columns. At minimum, document the difference loudly.

### F7 · Booleans: the bare-adjective style won — bless it
138 bare booleans (`active`, `drivable`, `remote`, `jurisdictional`, `court_ordered`, `service_complete`) vs 16 prefixed (`is_attorney`, `can_approve_level`, `requires_review`). `core.staff` mixes both styles in one table (`active` + `is_attorney`).
**Suggest:** no mass rename — declare bare-adjective the standard, reserving `is_`/`can_`/`has_` for where the bare word would be ambiguous (`is_attorney` stays: bare `attorney` reads as a name; `can_clear_conflicts` stays: capability). Write the rule down so the next 50 booleans don't re-litigate it.

### F8 · Same ref, two names: `client_matter.current_stage` vs `stage_history.stage_code`
Both FK `ref.matter_stage.code`.
**Suggest:** `current_stage` → `current_stage_code` (says both what it is and that it's a code).

### F9 · The text-field taxonomy is *almost* deliberate
`name` = proper noun of a real thing (org, court, template) · `label` = ref-table display text · `title` = headline of a work item (document, task, filing) · `notes` = freeform everywhere. That taxonomy holds well. Stragglers: `workflow.task.detail` vs `core.intake_lead.description` vs `workflow.template.description` (same role, two words), and `display_name` appears in exactly two places (`claim_adjuster`, `mediation_candidate`).
**Suggest:** `task.detail` → `description`; accept `display_name` as the "denormalized human name when there may be no person row" pattern and document it.

### F10 · Minor loose ends (each a one-liner)
- `litigation.service_of_process` PK is `service_id` — convention says `service_of_process_id`; alternatively rename the table `service`. Also `analytics.closed_case_snapshot.case_type` stores a code → `case_type_code`.
- `date_of_birth` / `date_of_death` / `date_of_loss` invert the `X_date` order — idiomatic legal/medical usage; keep, list as sanctioned exceptions.
- `ref.court_holiday` PK `holiday_date` — natural key, fine; document alongside the `ref.*.code` exception.
- `medical.clinical_event.completed` (boolean) next to `status` columns elsewhere for the same idea — pick per-table, low stakes.

---

## Suggested action plan (when you say go — nothing has been touched)

1. ~~**Now-or-never freebie:** F1 — drop the duplicate `challenge_expert_deadline`.~~ ✅ **DONE 2026-07-13** (Michael approved): applied to the build database via `Tuttle_PM_Schema_v2.3_F1_fix_APPLIED.sql` after a proven scratch round trip; safety check confirmed the column was empty; `apply_scheduling_order()` unaffected; surviving column now carries an explanatory comment. Rollback script on file.
2. ~~Cheap renames~~ / 3. ~~event-date sweep~~ / 4. ~~style guide~~ — ✅ **ALL DONE 2026-07-13** (Michael: "full sweep"): applied as `Tuttle_PM_Schema_v2.5_naming_APPLIED.sql` — **56 renames** (F2, F3, F4 incl. the claim_adjuster type trap, F5, F8, F9 incl. medical.clinical_event.detail, F10), **7 functions token-patched** in the same transaction, **7 views rebuilt** so their output columns speak the new names, migrate.sql updated (staging vocabulary untouched — it mirrors CasePeer verbatim). Verified: byte-identical rollback round trip (columns + all function bodies + all view definitions fingerprinted); full clean-room pipeline rehearsal v2.0→v2.5 + 770-case replay (row parity with build); 14/14 18.001 behavior tests + regression battery green on rehearsal AND build; zero old names remain outside staging. The **Naming Standard is now codified in DESIGN_NOTES.md**. Remaining deliberately-open item: F6 supersede-direction flip (write-pattern change, not a rename) — documented, awaiting a deliberate decision.

*Prepared without modifying any object. All counts verified against the live v2.1 build (tuttle_v21).*
