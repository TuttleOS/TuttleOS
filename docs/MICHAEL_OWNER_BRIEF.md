# Tuttle OS — Status Brief for Michael Tuttle

**Date:** July 18, 2026  
**Prepared for:** Michael Tuttle (Owner / Attorney)  
**Firm:** Tuttle Law Firm d/b/a Crash Guy Injury Attorneys  
**How to use this doc:** Paste into Claude (or share as-is) as the briefing source for a clear owner presentation. Prefer plain language; ask for one next decision at a time.

---

## One-sentence summary

Tuttle OS is your firm’s internal practice system — built so the **database** (not the screens) owns security, deadlines, work generation, and audit. The spine is built. We are paused on **your** decisions before we invent more workflows or touch real client data.

---

## What it is (and isn’t)

| It is | It is not |
|---|---|
| One staff web app (Intake → CM → Lit → Owner) | A client / consumer portal |
| Role-based workspaces after login | A CasePeer clone with fake UI rules |
| Postgres + RLS as the real security gate | “Hidden buttons” as security |
| ATTORNEY-VERIFY on rule-computed legal dates | A system that presents computed deadlines as final |
| Fictional demo data until you say otherwise | Production PHI without a signed Supabase BAA |

**Live demo:** https://tuttle-os-tuttle-os.vercel.app  
**Local:** http://127.0.0.1:3000 (from the `web/` folder)  
**Walkthrough for you:** in-app **Walkthrough** (`/test`) or `docs/TESTNOTES.md` (~45–60 min)

---

## Who lands where after login

| Person / role | Home |
|---|---|
| Michael (attorney / owner) | `/owner` — Firm attention, Approvals, SOL Watch |
| Case Managers (e.g. Christina) | `/cases` |
| Litigation PL (e.g. Daniel) | `/litigation` |
| Intake | `/intake` |
| Kate (Demand) / Emily (Liens) / Review | `/demands` · `/liens` · `/review` — **skeletons only** until you sign screens |

Attorney / admin / senior PL also get a **firm-wide left menu** so you can reach Intake, CM, Lit, and specialty queues without changing accounts. The database still blocks what each role should never see.

---

## Build status (honest)

| Phase | What | Status |
|---:|---|---|
| 0 | Database + security model | **Done (eng)** — BAA still required before real PHI |
| 1 | Login, shell, search, theme | **Done (MVP)** |
| 2 | Intake | **Done (MVP)** |
| 3 | Case Manager | **Done (MVP)** — not every mockup card yet |
| 4 | Litigation | **Done (MVP)** — pizza tracker / full discovery later |
| 5 | Owner dashboard | **Done (MVP)** — recently restyled; same firm-attention job |
| 6 | CM ↔ Lit switcher | **Done (MVP)** |
| 7 | Demand / Liens / Review | **Skeletons — waiting on your screen sign-off** |
| 8 | Documents + AI/OCR | **Deferred — you said no AI yet** |
| 9 | Live Outlook / Google calendar | **Scaffold only — you said do not connect yet** |
| 10 | CasePeer CSV load | **Scaffold — owner-run; CSVs stay in Dropbox** |

**MVP** means the daily job works against the real schema — not a pixel-perfect copy of every mockup.

### Still deliberately unfinished (not bugs)

- 17-node litigation “pizza tracker”  
- Full discovery / mediation pipeline  
- Settings page (theme toggle exists; firm Settings not built yet)  
- Live calendar sync  
- AI on medicals  
- Real CasePeer production load  

---

## Decisions already on record (confirm or change)

| Topic | Your decision | Effect |
|---|---|---|
| AI / OCR | **Not using AI in the project yet** | Phase 8 stays off |
| Live calendar | **Do not connect Outlook/Google yet** | Dry-run settings only |
| CasePeer files | Stay in Dropbox; never in git | Load only when you run the script |
| After migration | Dropbox/CasePeer = frozen archive | No two-way sync |

---

## What we need from you next

### 1. Direction
Confirm the 0–10 spine above is still the right product.

### 2. Phase 7 screens (blocking further feature inventing)
Read-only queues exist. We will **not** invent Kate’s, Emily’s, or Daniel’s buttons until you sign:

**`docs/PHASE7_SCREEN_PROPOSALS.md`**

| Role | Proposed primary screen |
|---|---|
| Kate — Demand | Demand readiness board |
| Emily — Liens | Lien worklist (settled-first) |
| Daniel — Review | Open 7-day viability reviews |

### 3. Compliance before real clients
| Gate | Ask |
|---|---|
| **Supabase BAA** | Signed before any production PHI or CasePeer load? |
| **CasePeer load** | Rehearsal DB first, then production when ready? |
| **MFA / password manager** | Firm ops timeline for all staff? |

### 4. Pick one next engineering priority
- Deepen Case Manager / Litigation daily surfaces (pizza tracker, discovery, etc.)  
- **or** Phase 7 actions after you sign the screens  
- **or** CasePeer rehearsal load after BAA  

---

## Are we on track?

**Yes.** Architecture and phase gates match the plan. Recent work was **Owner UI polish** (softer cards, clearer firm menu, Walkthrough call-out) — still “firm attention,” not a personal caseload home. We have **not** drifted into AI, live calendar, or inventing Phase 7 workflows.

**Precision notes (so nothing overclaims):**

- Schema core is **v2.5**; calendar + coverage helpers (v2.7 / v2.8) are scaffolds on top.  
- “~770 CasePeer cases” refers to the **migration pipeline / rehearsal design**, not the current demo database (demo uses a few fictional matters).  
- Production URL requires Vercel access / login; Deployment Protection must stay off for non-team visitors if you want outsiders to reach the login page.

---

## Risks (plain language)

| Risk | What we’re doing |
|---|---|
| Screens look “MVP” not full mockup | Incremental, schema-backed; no fake workflows |
| Real client data in the wrong place | BAA gate + fictional seeds + owner-only migration |
| Building the wrong Demand/Lien/Review UX | Hard stop until you sign Phase 7 |
| Calendar silently wrong | Live sync stays off until you reopen it |

---

## Suggested talking points for Claude → Michael

1. **Database is the product** — UI displays and captures; Postgres computes deadlines, generates tasks, and enforces who can see what.  
2. **Daily workspaces for Intake, CM, Lit, and Owner exist** and are demoable via Walkthrough.  
3. **Three owner gates control the next chapter:** Phase 7 sign-off · Supabase BAA · keep AI/calendar deferred (or reopen).  
4. **Ask Michael for one priority** so engineering doesn’t thrash.  
5. **Do not promise** live calendar, AI medical review, or CasePeer production load until those gates clear.

---

## Owner sign-off block (copy / reply)

```
Owner: Michael Tuttle
Date: ________

1. Overall direction (phases 0–10)
   ☐ Approved   ☐ Approved with notes   ☐ Pause / rework
   Notes: ________________________________________________

2. Deferred decisions (no AI yet; no live calendar yet)
   ☐ Confirmed   ☐ Change — reopen: _______________________

3. Phase 7 screens (see PHASE7_SCREEN_PROPOSALS.md)
   Demand Writer:       ☐ Approved  ☐ Notes  ☐ Rework
   Lien / Disbursement: ☐ Approved  ☐ Notes  ☐ Rework
   Senior Review:       ☐ Approved  ☐ Notes  ☐ Rework

4. Next engineering priority (pick one)
   ☐ Deepen Case Manager / Litigation
   ☐ Phase 7 actions after screen sign-off
   ☐ CasePeer rehearsal load (after BAA)
   ☐ Other: _____________________________________________

5. Supabase BAA status
   ☐ Signed   ☐ In progress   ☐ Not started

Signed: ____________________________
```

---

## Related docs (if Michael wants depth)

| Doc | Use |
|---|---|
| `docs/OWNER_PROJECT_AUDIT.md` | One-page audit + same sign-off form |
| `docs/TESTNOTES.md` | Click-through checklist |
| `docs/PHASE7_SCREEN_PROPOSALS.md` | Kate / Emily / Daniel proposals |
| `docs/PROJECT_PHASES.md` | Full phase plan |
| `docs/CASEPEER_MIGRATION.md` | How CasePeer load works |
| `docs/COMPLIANCE_GATES.md` | Security exit checklist |
| `docs/ui-design-decisions.md` | Your UX rulebook |

---

*Engineering will not advance Phase 7 actions, Phase 8 AI, or live calendar until the matching items above are approved or explicitly reopened.*
