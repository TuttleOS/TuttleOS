# Tuttle OS — Compliance & Security Phase Gates

Owner-approval and engineering gates. A phase is **not done** until its security gate passes, even if UI looks complete.

Related: [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md), [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md), [SECURITY_ADDONS_BACKLOG.md](SECURITY_ADDONS_BACKLOG.md).

Legend: **E** = engineering · **O** = owner (Michael) · **V** = vendor/contract

---

## Phase 0 — Database foundation

| # | Gate | Owner | Done |
|---|---|---|---|
| 0.1 | Supabase project provisioned (Postgres 15+; extensions: pgcrypto, citext, btree_gist, pg_trgm, vector as needed) | E | ☐ |
| 0.2 | Run `sql/01` → `sql/05` in order | E | ☐ |
| 0.3 | Expose schemas in API settings: `core, intake, medical, insurance, litigation, property, resolution, liens, finance, workflow, ref, analytics` | E | ☐ |
| 0.4 | `GRANT app_staff TO authenticated;` (and usage per scripts) | E | ☐ |
| 0.5 | `sql/tests/test_v2.5_battery.sql` — all asserts PASS | E | ☐ |
| 0.6 | **Supabase BAA signed before any production PHI** | O / V | ☐ |
| 0.7 | Separate staging vs production projects (or equivalent isolation) decided | O / E | ☐ |

**Exit:** Battery green; no real client data until 0.6.

---

## Phase 1 — Foundation (app shell, auth, search)

| # | Gate | Owner | Done |
|---|---|---|---|
| 1.1 | Supabase Auth enabled; MFA **enforced** for all staff | E / O | ☐ |
| 1.2 | Each staff Auth user linked: `core.staff.auth_user_id` set | E | ☐ |
| 1.3 | Unlinked / inactive staff cannot use the app | E | ☐ |
| 1.4 | App routes require authenticated session | E | ☐ |
| 1.5 | Role routing from `staff.role_code` (intake / cases / litigation / owner + placeholders) | E | ☐ |
| 1.6 | Locked nav shows 🔒 + tier tooltip; RLS still enforces | E | ☐ |
| 1.7 | Security headers shipped (CSP, HSTS, frame, referrer, permissions) | E | ☐ |
| 1.8 | PHI-safe logging (no names/DOB/medical/claim text in client or server error logs) | E | ☐ |
| 1.9 | `.env` / Vercel secrets set from `.env.example`; no secrets in git | E | ☐ |
| 1.10 | RLS regression matrix (Phase 1 subset) green — see SECURITY_TEST_PLAN | E | ☐ |
| 1.11 | MFA enrollment checklist completed for go-live staff | O | ☐ |
| 1.12 | Password manager adopted firm-wide | O | ☐ |

**Exit:** Auth + MFA + staff link + headers + RLS smoke tests.

---

## Phases 2–5 — Workspaces (Intake → CM → Litigation → Owner)

Apply **every** workspace phase:

| # | Gate | Owner | Done |
|---|---|---|---|
| W.1 | Every write resolves an actor (DB loud-fail if not) | E | ☐ |
| W.2 | All list queries filter `deleted_at IS NULL`; UI delete = soft delete | E | ☐ |
| W.3 | Role-restricted screens verified via **RLS** (API), not UI-only | E | ☐ |
| W.4 | Playwright: locked nav + denied API paths for restricted roles | E | ☐ |
| W.5 | Dates always `MMM d, yyyy` (year present) | E | ☐ |
| W.6 | No client-computed legal deadline stored as authoritative | E | ☐ |
| W.7 | Conflicts: pending clearance blocks cross-matter copy (DB) | E | ☐ |
| W.8 | Intake: rejection incomplete until non-engagement letter path | E | ☐ |
| W.9 | ATTORNEY-VERIFY badge on rule-computed dates | E | ☐ |
| W.10 | Phase-specific Playwright bar from mockups passes | E | ☐ |

### Phase 4 extra (litigation engines)

| # | Gate | Owner | Done |
|---|---|---|---|
| 4.a | Task-chain migration (`ref.task_chain_step` + triggers) rehearsed on scratch DB + rollback | E | ☐ |
| 4.b | TRCP 99 answer-due on return-of-service lives in **DB**, not client JS | E | ☐ |
| 4.c | `test_v2.5_battery.sql` still green after new migrations | E | ☐ |

### Phase 5 extra (owner)

| # | Gate | Owner | Done |
|---|---|---|---|
| 5.a | Level approval / conflict clearance only for capability holders | E | ☐ |
| 5.b | Override patterns / audit views attorney-visible | E | ☐ |

---

## Phase 6 — Cross-workspace

| # | Gate | Owner | Done |
|---|---|---|---|
| 6.1 | Workspace switcher audits under **acting user** identity | E | ☐ |
| 6.2 | Companion / conflict-waiver rules still DB-enforced when switching | E | ☐ |
| 6.3 | Notifications contain no unnecessary PHI in push/email subjects | E | ☐ |

---

## Phase 7 — Remaining workspaces (Demand / Liens / Review)

| # | Gate | Owner | Done |
|---|---|---|---|
| 7.1 | Skeleton pages only until owner reviews screen proposals | E / O | ☐ |
| 7.2 | Finance / lien detail remains finance-tier RLS | E | ☐ |
| 7.3 | **Do not invent** workflow without owner sign-off | O | ☐ |

---

## Phase 8 — Documents + AI (owner-gated)

| # | Gate | Owner | Done |
|---|---|---|---|
| 8.1 | Owner approves adopting v2.2 storage | O | ☐ |
| 8.2 | Apply `06_upgrade_v2.2_documents.sql` on scratch → prod path; rollback proven | E | ☐ |
| 8.3 | Private `case-documents` bucket + storage policies from script comments | E | ☐ |
| 8.4 | Signed URL issuance logs to `workflow.document_access_log` | E | ☐ |
| 8.5 | Intake cannot read restricted doc metadata **or** file bytes | E | ☐ |
| 8.6 | Feature flag AI/OCR **off** by default | E | ☐ |
| 8.7 | **BAA signed: OCR vendor** before any cloud OCR on real PHI | O / V | ☐ |
| 8.8 | **BAA / HIPAA arrangement: Anthropic (Claude)** before summarize/extract on real PHI | O / V | ☐ |
| 8.9 | Apply `07_upgrade_v2.6_documents_ai.sql` only after 8.2–8.5 | E | ☐ |
| 8.10 | Pilot **closed** case, then one active; watch failed job queue | E / O | ☐ |
| 8.11 | Document / AI RLS + access-log tests green | E | ☐ |

**Hard stop:** No real medical records in OCR/AI pipeline until 8.7 and 8.8.

---

## Phase 9 — Calendar sync

| # | Gate | Owner | Done |
|---|---|---|---|
| 9.1 | Calendar vendor DPA in place (Microsoft Graph and/or Google) | O / V | ☐ |
| 9.2 | Event titles/bodies minimize PHI (no medical narrative dumps) | E | ☐ |
| 9.3 | Vacaturs/moves push; failures visible (no silent drift) | E | ☐ |

---

## Phase 10 — CasePeer migration

Runbook: [CASEPEER_MIGRATION.md](CASEPEER_MIGRATION.md). Engineering scaffold ships the script + hardened SQL; **gates stay open until the owner runs a real load**.

| # | Gate | Owner | Done |
|---|---|---|---|
| 10.1 | CSVs remain outside git (Dropbox only) | O | ☐ |
| 10.2 | Migration run on owner-controlled path; migration actor set for audit | E / O | ☐ |
| 10.3 | Post-load: battery + spot RLS checks + SOL reconciliation review | E / O | ☐ |
| 10.4 | Dropbox kept as frozen parallel archive (no bidirectional edit sync) | O | ☐ |

---

## Standing owner decisions (track in DECISIONS_NEEDED.md if open)

| Topic | Status needed |
|---|---|
| Supabase BAA | Required before PHI |
| OCR + Claude BAAs | Required before Phase 8 PHI processing |
| Formal retention schedule | Attorney policy |
| Trust-account SOPs | Attorney policy |
| Call recording / TCPA posture | Firm ops |
| Brand theme vs Parchment | Cosmetic; not a security gate |

---

## Sign-off template

```
Phase: ____
Date: ____
Engineering: battery / RLS matrix / Playwright: PASS | FAIL
Owner approvals required this phase: ____
Vendor/BAA items: ____
Blocked items: ____
Signed (eng): ____
Signed (owner, if required): ____
```
