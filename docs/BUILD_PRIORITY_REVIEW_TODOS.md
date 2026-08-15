# Tuttle OS — Build Priority (from 7/26 screen recording review)

Ordered so data integrity and testability come before features, and the one-time migration comes last, once the schema it's loading into is stable. Rationale: bugs in stages 1–2 get baked into real case data if shipped late; the migration is a single irreversible event and should run against a settled build, not a moving target.

**Status checked:** 2026-07-28 against branch `role-partition` + kit docs (`ROLE_TEST_ACCOUNTS`, `ROLES_AND_PERMISSIONS`, Pass 1–4 role work).

## Stage 0 — Foundation (do first, blocks verifying everything else)
- [x] Add dummy/test logins per role (intake, case manager, litigation paralegal) — nothing below can be properly reviewed while everything previews as attorney.
  - **Done:** `cm.demo`, `lit.demo`, `intake.demo`, plus `demand.demo` / `liens.demo` / `review.demo`. Matrix: `docs/ROLE_TEST_ACCOUNTS.md`. Provision: `scripts/provision_role_test_accounts.cjs` + `sql/seeds/seed_role_test_staff.sql`. Attorney/admin also get **Role roster preview** (header) without signing out.
- [x] Confirm whether all incremental feedback from earlier rounds is actually incorporated into the current build, or run a consolidation pass against the original spec. Building further stages on an uncertain baseline compounds rework.
  - **P1 consolidation done (2026-07-28):** Walked all Jul 19 **P1** findings vs `role-partition`. Result: **0 P1 DONE**; F-21 DESIGNED→PARTIAL; F-37 enriched (directionality). Full write-up in `docs/FINDINGS_CHECKLIST.md` § Stage 0. **P2/P3 not re-walked.** Stage 3 CM beta = ship with known P1 gaps, not “findings cleared.” Michael decisions (F-01/F-04/F-05/F-14) still block intake/contract depth.

## Stage 1 — Data Integrity & Validation
Fix before more real cases flow through these paths — much harder to clean up after the fact than to prevent.
- [x] Bug: duplicate property damage / second-vehicle entries can be created when there should only be one. Add validation to block it.
  - **Done (2026-07-28):** `startPdClaimAction` / vehicle edit reject same year+make+model on the incident (case-insensitive); soft-deleted vehicles ignored.
- [x] Add undo/remove for a mistakenly-added entry (surfaced by the same bug).
  - **Done (2026-07-28):** PD vehicle cards have **Edit** + **Remove** (soft-delete `pd_claim` + `vehicle`).
- [x] Lock demand/counter directionality as a validation rule: demands always originate from the firm (plaintiff); offers/counters always originate from the insurer. Prevent mislinking.
  - **Done (2026-07-28):** UI locks side by event type; `logNegotiationAction` rejects mismatches; SQL `21_upgrade_v2.20_negotiation_directionality.sql` CHECK (apply on Supabase when ready).
- [x] Tag uploaded photos to their property damage entry so they're browsable from that section (part of the same data model fix).
  - **Done (2026-07-28):** Upload picker / per-vehicle upload tags `[pd_vehicle:<id>]` in document notes; thumbnails filter per vehicle + lightbox.
- [x] Clarify the treatment/coverage box labels (N/A vs. Declined/Declared) — low effort, bundle with the above while touching that section.
  - **UI (2026-07-28):** Coverage boxes use **No treatment** / “No treatment in this category” (DB still `coverage_na`). Declined PIP/MedPay remains a separate insurance concept — not this button.

## Stage 2 — Role Dashboards
The piece Brett specifically wants ready before wider access — drives adoption and gives each role a reason to log in daily.
- [x] Per-user case manager dashboard: assigned cases, new cases, SOL/liability/duty pending, scoped to login.
  - **Done (MVP on `role-partition` / preview):** Assigned caseload + **Needs attention** board; work queues (New cases / LORs / Liability / PD / Records) with live counts. Not merged to production yet.
- [x] Per-user litigation paralegal dashboard: same concept, scoped to their caseload.
  - **Done (MVP):** Lit **Needs attention** (JX due / no cause / PL unassigned) + assigned caseload list.
- [x] Make the at-a-glance counts visual (not just a numbers column) so what needs attention is obvious on login.
  - **Done (MVP):** Number-tile strips replaced with attention-weighted case lists (`NeedsAttentionBoard` / Lit equivalent).

## Stage 3 — Case Manager Beta Rollout
- [ ] Ship the CM workspace to real case managers once Stages 0–2 are stable.
  - **Locked 2026-08-15:** **Mark Garza (1 CM)** · **stagger** lit · **preview only** · **preview + demo**. Do **not** merge to `main`. Swap/add CMs later without a rebuild. Runbook: `docs/CM_BETA_RUNBOOK.md`.
- [x] Decide whether litigation rollout should be staggered after CM or launched together.
  - **Locked 2026-08-15:** **Stagger** — CM beta now; lit remains Stage 5.

### Stage 3 checklist
- [x] Michael confirms lit stagger + pilot size (**1 CM**, stagger)
- [x] Week-1 is **preview-only** + **demo** (no prod merge, no live-matter requirement)
- [x] Named the 1 CM (**Mark Garza**). Christina / Emily can be added or swapped later.
- [ ] Known gaps (§2 of runbook) sent to Mark
- [ ] Preview smoke with `cm.demo` (`/cases` queues + Needs attention)
- [ ] PR merged `role-partition` → `main` — **later**, only if Michael says CMs may use prod
- [ ] Post-deploy smoke on production — **not this week**

## Stage 4 — New Workflow: Settlements Pending / Disbursement
Needs to exist before any case actually reaches settlement in the new system, but isn't needed for the initial CM beta.
- [ ] Build the settlement-to-disbursement stage: client signs release → release sent to insurer → checks received → verify no outstanding UIM claim → disbursement, as a tracked checklist.
  - Related: `/liens` has finance-UI blocked banner; full settlement checklist **not** built (ROLES §8.1#8).

## Stage 5 — Litigation Rollout (if staggered)
- [ ] Roll out the litigation paralegal module once dashboards and validation have proven out in CM beta.

## Stage 6 — Migration Prep & Execution
Last, and only once the schema above is stable — migrating into a build that's still changing means re-doing the migration.
- [ ] Resolve the unclear questions first (blocking): "scratch vs. staging" / Supabase environment question, "my plot account" reference, "the plot has the level that has protections" — get these re-asked in plain language before deciding anything downstream of them.
- [ ] Decide merge approach for the 9 duplicate name-pair cases (keep notes, merge into the correct case, don't delete either side).
- [ ] Confirm the 101 closed cases stay searchable with notes intact (conflict-check requirement).
- [ ] Scope the wrongful termination case workflow (PD = N/A, still needs the rep letter, differs enough to need its own walkthrough) before migrating those.
- [ ] Identify informally-closed cases and formally close them as part of migration.
- [ ] Check whether a "case tier" report exists to cross-reference file dates for the 212 litigation cases.
- [ ] Review "pending drops" individually before the dry run executes.
- [ ] Run the migration dry run, then the live migration.

(Already resolved: "City" column = client's home address city, e.g., Beaumont.)

---

## Related kit docs
- `docs/LIFECYCLE_BUILD_PLAN.md` — **canonical** case-lifecycle sequencing (protect rules, Tracks A–F, top 10 gaps)
- `docs/ROLE_TEST_ACCOUNTS.md` — demo logins
- `docs/ROLES_AND_PERMISSIONS.md` — partition SoT + §8 build status
- `docs/PROJECT_SECTIONS_BY_ROLE.md` — section × role map
- `docs/FINDINGS_CHECKLIST.md` — Jul 19 findings + P1 consolidation
- `docs/CM_BETA_RUNBOOK.md` — **Stage 3** CM beta known gaps + ship path
- `docs/CLAUDE_PROMPT_LIFECYCLE_FLOW_VS_BUILD.md` — full scored inventory for Claude diagrams
- Preview: https://tuttle-os-git-role-partition-tuttle-os.vercel.app
