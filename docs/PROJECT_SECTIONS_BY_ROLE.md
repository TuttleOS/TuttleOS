# Tuttle OS — Project sections × role access

**Purpose:** One map of every product section and which staff role can open it.  
**SoT for job duties + partition intent:** [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) (JD-controlling; §8 lists build gaps)  
**Demo logins:** [ROLE_TEST_ACCOUNTS.md](ROLE_TEST_ACCOUNTS.md)  
**RLS detail:** [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md) · [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md)

**Admin / attorney:** Click name/role in the header → role roster (who holds each role) → preview that workspace. Audit stays the attorney. See [ROLE_TEST_ACCOUNTS.md](ROLE_TEST_ACCOUNTS.md).

**Rule:** Nav 🔒 is a hint. **Postgres RLS is the gate.** UI must never grant what the DB forbids.

Legend:

| Symbol | Meaning |
|---|---|
| ✓ | Full access (home workspace or firm-wide nav) |
| ◐ | Limited (milestones / skeleton / assigned-only) |
| 🔒 | Shown locked in nav — DB also denies deeper data |
| — | Not in that role’s primary nav (may still deep-link; RLS applies) |
| † | Capability flag (`can_approve_level` / `can_clear_conflicts`), not role alone |

Slug: use `lien_disbursement` everywhere (`lien_specialist` is deprecated).

---

## Pass status (2026-07-27 role partition)

| Pass | Item | Status |
|---|---|---|
| 1 | Gate `senior_paralegal` † | Done — Approvals nav locked without flags; seed flags off; actions use `staffCanApproveLevel` |
| 1 | Quarantine `admin` / `records_clerk` | Done — docs + deactivate `records_clerk` in v2.19; finance writes via `staffCanWriteFinance` (attorney \| lien only) |
| 1 | Slug `lien_disbursement` | Done — `lien_specialist` retired in SoT |
| 2 | Matter read-only for demand / lien | Done — `?mode=readonly` + server mutate deny |
| 3 | `core.staff_role_grant` | Done — sql/20 + `getCurrentStaff().roles` / `hasRole` |
| 4 | CM/Lit attention boards | Done — Needs attention lists replace number tiles |
| 4 | Liens finance banner | Done — blocked banner until finance UI |

**Admin:** Brett (`brett.earl@gmail.com`) is the only named holder. Do not seed admin demos. Superuser duties still pending Michael (§8.2).

**records_clerk:** Unused — rows deactivated in v2.19; no workspace; do not grant defaults.

---

## 1. Project sections (what exists)

### A. Intake workspace — `/intake`

| Section | Route | Status |
|---|---|---|
| Lead queue | `/intake` | Live |
| New lead | `/intake/new` | Live |
| My activity | `/intake/activity` | Live |
| Lead detail | `/intake/leads/[id]` | Live |
| Contract package | `/intake/contracts/[packageId]` | Live |

### B. Case Manager workspace — `/cases`

| Section | Route | Status |
|---|---|---|
| My caseload | `/cases` | Live |
| New cases queue | `/cases/new-cases` | Live (preview branch for tabs until merge) |
| LORs pending | `/cases/lors` | Live |
| Liability pending | `/cases/liability` | Live |
| PD pending | `/cases/pd` | Live |
| Records pending | `/cases/records` | Live |
| Provider calls | `/cases/calls` | Live |
| My tasks | `/cases/tasks` | Live |
| Matter detail | `/cases/[id]` | Live |
| Financials | `/cases/financials` | **Locked** (finance tier) |

### C. Litigation workspace — `/litigation`

| Section | Route | Status |
|---|---|---|
| My cases | `/litigation` | Live |
| My tasks | `/litigation/tasks` | Live (full PL only) |
| Deadline horizon | `/litigation/deadlines` | Live (full PL only) |
| Lit matter detail | `/litigation/[id]` | Live (CM = milestones-only surface) |

### D. Owner workspace — `/owner`

| Section | Route | Status |
|---|---|---|
| Dashboard | `/owner` | Live |
| Approvals | `/owner/approvals` | Live |
| SOL watch | `/owner/sol` | Live |
| Calendar | `/owner/calendar` | Live |
| Migration | `/owner/migration` | Live |
| Walkthrough | `/test` | Attorney / admin only |

### E. Specialty (Phase 7) — stubs

| Section | Route | Status |
|---|---|---|
| Demands | `/demands` | Skeleton — Kate walkthrough before screens |
| Liens | `/liens` | Skeleton — Michael sign-off before detailing |
| Viability / review | `/review` | Thin — senior PL / owner |

### F. Shared / help

| Section | Route | Who |
|---|---|---|
| Global search | header → `/search` | All signed-in staff (results still RLS-filtered) |
| Version updates | `/updates` | All signed-in staff |

---

## 2. Role → home workspace

| Role (`role_code`) | Home after login | Primary sections |
|---|---|---|
| `intake` | `/intake` | A only (B/C locked in nav) |
| `case_manager` | `/cases` | B full; C via switcher **milestones only** |
| `litigation_paralegal` | `/litigation` | C full; B via switcher **full CM** |
| `demand_writer` | `/demands` | E Demands skeleton |
| `lien_disbursement` | `/liens` | E Liens skeleton (+ finance tier in DB) |
| `attorney` | `/owner` | D + firm-wide A–E |
| `admin` | `/owner` | Same as attorney (firm-wide) |
| `senior_paralegal` | `/owner` | Firm-wide nav; † decisions still flagged open with Michael |
| `records_clerk` | — | In DB only — no workspace wired |

---

## 3. UI access matrix (sections × roles)

Rows = project sections. Columns = roles.

| Section | intake | CM | Lit PL | Demand | Liens | Attorney | Admin | Senior PL |
|---|---|---|---|---|---|---|---|---|
| **Intake — Lead queue / New / Activity** | ✓ | — | — | — | — | ✓ | ✓ | ✓ |
| **CM — Caseload + work queues + calls + tasks** | 🔒 | ✓ | ✓ (switcher) | — | — | ✓ | ✓ | ✓ |
| **CM — Matter detail** | 🔒 | ✓ | ✓ (switcher) | — | — | ✓ | ✓ | ✓ |
| **CM — Financials** | 🔒 | 🔒 | 🔒 | — | —† | ✓ | ✓ | ◐‡ |
| **Lit — Cases (caseload)** | 🔒 | ◐ milestones | ✓ | — | — | ✓ | ✓ | ✓ |
| **Lit — Tasks / Deadlines** | 🔒 | 🔒 | ✓ | — | — | ✓ | ✓ | ✓ |
| **Lit — Matter (full tools)** | 🔒 | ◐ milestones | ✓ | — | — | ✓ | ✓ | ✓ |
| **Owner — Dashboard / Approvals / SOL / Calendar** | — | — | — | — | — | ✓ | ✓ | ✓ |
| **Owner — Walkthrough `/test`** | — | — | — | — | — | ✓ | ✓ | — |
| **Demands** | — | — | — | ✓ skeleton | — | ✓ | ✓ | ✓ |
| **Liens** | — | — | — | — | ✓ skeleton | ✓ | ✓ | ✓ |
| **Viability `/review`** | — | — | — | — | — | ✓ | ✓ | ✓ |
| **Version updates** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

† Liens role: finance **data** tier with attorney (see §4); nav Financials page still product-locked for non-owner roles until finance UI ships.  
‡ Senior PL sees firm-wide nav; treat finance/conflict/Level as † until Daniel’s authority is confirmed.

### CM ↔ Lit switcher (Phase 6)

| From role | Can open | Depth |
|---|---|---|
| `litigation_paralegal` | Full Case Manager workspace | Full CM tools; audit under paralegal’s name |
| `case_manager` | Litigation workspace | **Milestones only** — Tasks / Deadlines nav 🔒 |
| `attorney` / `admin` / `senior_paralegal` | Both | Full |

---

## 4. Data domains (RLS intent — not UI)

Product intent from security docs. Re-verify against live policies when smoking.

| Domain | intake | CM | Lit PL | Demand | Liens | Attorney |
|---|---|---|---|---|---|---|
| Leads / intake | ✓ | —* | —* | —* | —* | ✓ |
| Matters (core) | limited | ✓ | ✓ | ✓ | ✓ | ✓ |
| Medical / treatment | **DENY** | ✓ | ✓ | ✓† | ✓† | ✓ |
| Insurance / property | **DENY** | ✓ | ✓ | ✓† | ✓† | ✓ |
| Litigation court / service | **DENY** | milestones UI | ✓ | ✓† | ✓† | ✓ |
| Discovery work product | **DENY** | **DENY** | ✓ | **DENY** | **DENY** | ✓ |
| Liens / resolution | **DENY** | limited† | limited† | limited† | ✓ | ✓ |
| Finance detail | **DENY** | **DENY** | **DENY** | **DENY** | ✓ | ✓ |
| Conflict clear / Level approve | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | ✓ († flags) |

\* Non-intake roles may reach intake via firm-wide nav (owner) or not at all (CM home).  
† Confirm against live RLS; critical permanent DENYs are **intake** + **finance** (non–lien/attorney) + **discovery** (non–lit/attorney).

---

## 5. Caseload scoping

| Role | Matter list default |
|---|---|
| `case_manager` | **Assigned only** (`staff_assignment` as CM) |
| `litigation_paralegal` | **Assigned only** (as lit PL) |
| `attorney` / `admin` / `senior_paralegal` | Firm-wide |
| `intake` | Leads world — not CM caseload |

---

## 6. How to use this while testing

1. Sign in with the matching demo account ([ROLE_TEST_ACCOUNTS.md](ROLE_TEST_ACCOUNTS.md)).  
2. Confirm **home route** matches §2.  
3. Walk §3 for that column — every ✓ opens; every 🔒 stays locked / empty.  
4. For intake + finance + discovery, also run SQL/API checks from [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md) (UI alone is not enough).

---

## Related

- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) — duties, escalations, open gaps  
- [PROJECT_PHASES.md](PROJECT_PHASES.md) — phase build status  
- [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md) — security gates per phase  
- Nav source: `web/src/components/shell/AppShell.tsx`  
- Switcher rules: `web/src/lib/workspace.ts` · homes: `web/src/lib/staff.ts`
