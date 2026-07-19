# Tuttle OS — High-Level Project Audit for Owner Approval

**To:** Michael Tuttle  
**From:** Engineering  
**Date:** 2026-07-18  
**Purpose:** One-page status of what is built, what is deferred by your decisions, and what needs your sign-off next.  
**Repo:** https://github.com/TuttleOS/TuttleOS  

---

## Executive summary

Tuttle OS is the firm’s internal practice OS (Crash Guy / Tuttle Law): **one staff web app** on **Next.js + Supabase**, role-based after login. The **database schema and security model are production-ready**; the **product UI has MVP coverage across the main workspaces**.

We are **not** inventing workflows the schema does not support. Legal dates stay **ATTORNEY-VERIFY**. Real client data stays out of git.

| Verdict | Detail |
|---|---|
| **Build spine** | Phases **0–10** all have an MVP or scaffold — no blank phase left to invent. |
| **Ready for daily use (demo / rehearsal)** | Intake, Case Manager, Litigation, Owner, CM↔Lit switcher. |
| **Blocked on you** | Phase 7 screen designs · Supabase BAA before real PHI · CasePeer load when you choose. |
| **Explicitly deferred by you (2026-07-18)** | **No AI/OCR** · **No live calendar connection**. |

---

## What we are building

| Role | Home after login |
|---|---|
| Intake | Lead queue `/intake` |
| Case Manager | Caseload `/cases` |
| Litigation Paralegal | Lit caseload `/litigation` |
| Attorney / Admin / Senior PL | Owner `/owner` |
| Demand Writer / Lien / Review | Queues only (skeletons) until you approve Phase 7 |

**Non‑negotiables already in the build:** soft delete · actor on every write · RLS as the real gate · dates `MM/DD/YYYY` · no client-side “authoritative” deadline math · fictional seeds only until CasePeer migration.

---

## Phase status (high level)

| Phase | What it is | Status |
|---:|---|---|
| **0** | Database schema + behavior battery | **Done (eng)** — BAA still required before real PHI |
| **1** | Login, shell, roles, search, theme | **Done (MVP)** |
| **2** | Intake workspace | **Done (MVP)** |
| **3** | Case Manager workspace | **Done (MVP)** — not every mockup card yet |
| **4** | Litigation Paralegal workspace | **Done (MVP)** — pizza tracker / full discovery later |
| **5** | Owner dashboard (stalled, approvals, SOL) | **Done (MVP)** |
| **6** | CM ↔ Litigation switcher + identity banner | **Done (MVP)** |
| **7** | Demand / Liens / Review | **Skeleton** — **awaiting your screen sign-off** |
| **8** | Documents + AI | **Storage UI shipping** — apply `sql/16`; AI still deferred |
| **9** | Calendar ↔ deadlines | **Scaffold** — dry-run only; **no live Graph/Google** per you |
| **10** | CasePeer CSV → Tuttle OS | **Scaffold** — owner-run script; CSVs stay in Dropbox |

Detail and diagrams: `docs/PROJECT_PHASES.md`.

---

## Already decided (confirm or change)

| Topic | Your decision (recorded) | Effect |
|---|---|---|
| **AI / OCR (Phase 8)** | Not using AI in the project yet | No Claude/OCR on medicals; do not enable Phase 8 AI |
| **Live calendar (Phase 9)** | Do not connect a calendar yet | Dry-run only; no OAuth / vendor DPA wiring until reopened |
| **CasePeer CSVs** | Stay in Dropbox; never in git | Load only via owner-controlled script when you say go |
| **Dropbox after migration** | Frozen parallel archive | No bidirectional edit sync with CasePeer |

---

## What needs your approval next

### A. Phase 7 — Demand / Liens / Review screens (blocking further build)

Read-only queues exist. **We stop inventing Kate / Emily / Daniel actions until you sign** the proposals in:

**`docs/PHASE7_SCREEN_PROPOSALS.md`**

| Role | Proposed primary screen |
|---|---|
| Kate (Demand) | Demand readiness board |
| Emily (Liens) | Lien worklist (settled-first) |
| Daniel (Review) | Open 7-day viability reviews |

Sign-off block is at the bottom of that doc (Approved / Notes / Rework per role).

### B. Compliance / ops (before real client data)

| Gate | Ask |
|---|---|
| **Supabase BAA** | Signed before any production PHI or CasePeer load? |
| **CasePeer load (Phase 10)** | Approve a rehearsal DB first, then production when ready? |
| **MFA / password manager** | Firm ops — confirm timeline for all staff |

### C. Optional reopen later (not requested now)

- Document file storage without AI (`sql/optional/06`)  
- Live Microsoft Graph and/or Google Calendar (needs vendor DPA)  
- Deepen CM / Lit mockup cards (treatment, pizza tracker, discovery, etc.)

---

## How to try it (demo)

**Walkthrough checklist for Michael:** in-app **`/test`** (Owner → **Walkthrough**), or print `docs/TESTNOTES.md`.

1. App: **http://127.0.0.1:3000** (run from `web/` with `npm run dev`)  
2. Sign in as attorney (Michael) → Owner dashboard, Approvals, SOL Watch, Calendar sync, Migration status  
3. CM ↔ Lit switcher on shared matters  
4. Phase 7 queues: `/demands`, `/liens`, `/review` (often empty on demo data — expected)

---

## Risks / honesty

| Risk | Mitigation |
|---|---|
| MVP ≠ full mockup | Daily jobs work; remaining cards are incremental, schema-backed |
| Real PHI in wrong place | BAA + CasePeer pipeline only; seeds stay fictional |
| Building wrong Phase 7 UX | Hard stop until you sign proposals |
| Silent calendar drift | Live sync off until you reopen Phase 9 |

---

## Owner approval

Please check one box per section and return (email / Slack / signed copy).

```
Owner: Michael Tuttle
Date: ________

1. Overall direction (phases 0–10 spine as described)
   ☐ Approved   ☐ Approved with notes   ☐ Pause / rework
   Notes: ________________________________________________

2. Deferred decisions stand (no AI yet; no live calendar yet)
   ☐ Confirmed   ☐ Change — reopen: _______________________

3. Phase 7 screen proposals (see PHASE7_SCREEN_PROPOSALS.md)
   Demand Writer:     ☐ Approved  ☐ Notes  ☐ Rework
   Lien / Disbursement: ☐ Approved  ☐ Notes  ☐ Rework
   Senior Review:     ☐ Approved  ☐ Notes  ☐ Rework

4. Next engineering priority (pick one primary)
   ☐ Deepen Case Manager / Litigation (daily pain)
   ☐ Phase 7 actions after screen sign-off
   ☐ CasePeer rehearsal load (Phase 10) after BAA
   ☐ Other: _____________________________________________

5. Supabase BAA status
   ☐ Signed   ☐ In progress   ☐ Not started

Signed: ____________________________
```

---

## Related docs (if you want depth)

| Doc | Use |
|---|---|
| `docs/TESTNOTES.md` | Owner click-through checklist |
| `docs/PROJECT_PHASES.md` | Full phase flow + status |
| `docs/PHASE7_SCREEN_PROPOSALS.md` | Kate / Emily / Daniel sign-off |
| `docs/CASEPEER_MIGRATION.md` | How CasePeer load works (owner-run) |
| `docs/COMPLIANCE_GATES.md` | Security exit checklist by phase |
| `docs/ui-design-decisions.md` | Your UX rulebook |
| `mockups/*.html` | Clickable product spec |

---

*Engineering will not advance Phase 7 actions, Phase 8 AI, or live calendar until the matching items above are approved or explicitly reopened.*
