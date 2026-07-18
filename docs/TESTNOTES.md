# Tuttle OS — Owner test notes (Michael)

**Purpose:** Walk through the demo app once, check boxes, jot notes. Bring this back with `OWNER_PROJECT_AUDIT.md` and `PHASE7_SCREEN_PROPOSALS.md`.

**In-app checklist (preferred):** sign in as attorney → **Owner → Owner test notes** → http://127.0.0.1:3000/test  
(Pass / Fail / Skip + notes save in your browser only.)

**App:** http://127.0.0.1:3000  
**Login (attorney / Owner home):** `michael@tuttlelawfirm.com`  
*(Password: use the one Brett set in Supabase Auth — not stored in this repo.)*

**Data:** Fictional seeds only (e.g. Rosa Delgado, Chinedu Okafor). No real client PHI.

**How to use:** For each step — ☐ Pass · ☐ Fail · ☐ Skip — and a short note if Fail/Skip.

---

## Before you start

| Check | ☐ |
|---|---|
| Brett confirmed `npm run dev` is running from `web/` and the URL above loads | ☐ |
| You can sign in with your attorney account | ☐ |
| After login you land on **Owner** (`/owner`) | ☐ |

**Notes:** _______________________________________________

---

## 1. Shell & basics (~5 min)

| # | Try this | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 1.1 | Top nav: Owner, Cases, Litigation, Intake (and Demands / Liens / Review if shown) | ☐ | ☐ | ☐ | |
| 1.2 | Theme toggle (Parchment / Midnight) if available | ☐ | ☐ | ☐ | |
| 1.3 | Global search — type a demo name (e.g. Delgado) | ☐ | ☐ | ☐ | |
| 1.4 | Dates on screen look like **MM/DD/YYYY** (not day-first) | ☐ | ☐ | ☐ | |

**Overall shell:** ☐ Looks good · ☐ Needs rework: _______________

---

## 2. Owner dashboard (~10 min)

| # | Try this | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 2.1 | `/owner` — stalled / attention areas make sense at a glance | ☐ | ☐ | ☐ | |
| 2.2 | `/owner/approvals` — opens without error | ☐ | ☐ | ☐ | |
| 2.3 | `/owner/sol` — SOL Watch loads | ☐ | ☐ | ☐ | |
| 2.4 | `/owner/calendar` — **scaffold only**; no live Outlook/Google (expected) | ☐ | ☐ | ☐ | |
| 2.5 | `/owner/migration` — CasePeer status page loads (read-only) | ☐ | ☐ | ☐ | |

**Owner overall:** ☐ Approved · ☐ Notes: _______________

---

## 3. Case Manager (~15 min)

| # | Try this | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 3.1 | `/cases` — caseload lists demo matters | ☐ | ☐ | ☐ | |
| 3.2 | Open **Rosa Delgado** (or another seeded matter) | ☐ | ☐ | ☐ | |
| 3.3 | Matter page: stage / tasks / follow-up feel usable | ☐ | ☐ | ☐ | |
| 3.4 | Coverage / PD / records / demand cards show demo data where seeded | ☐ | ☐ | ☐ | |
| 3.5 | `/cases/calls` — Provider Calls page loads; add or view a log if comfortable | ☐ | ☐ | ☐ | |
| 3.6 | `/cases/tasks` — task list loads | ☐ | ☐ | ☐ | |

**CM overall:** ☐ Direction right · ☐ Missing for daily use: _______________

---

## 4. Litigation + CM↔Lit switcher (~10 min)

| # | Try this | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 4.1 | `/litigation` — lit caseload loads | ☐ | ☐ | ☐ | |
| 4.2 | Open a lit matter (Delgado / Okafor if present) | ☐ | ☐ | ☐ | |
| 4.3 | Deadlines / tasks areas load (`/litigation/deadlines`, `/litigation/tasks`) | ☐ | ☐ | ☐ | |
| 4.4 | On a shared matter: use **CM ↔ Litigation** switcher — lands on the other workspace for same client | ☐ | ☐ | ☐ | |
| 4.5 | Identity banner (who you are / role) still clear after switch | ☐ | ☐ | ☐ | |

**Lit overall:** ☐ Direction right · ☐ Needs: _______________

---

## 5. Intake (~10 min)

**Note:** “Mark contract sent” does **not** email or e-sign yet — status stub only. Real electronic send is a later vendor decision.

| # | Try this | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 5.1 | `/intake` — lead queue loads | ☐ | ☐ | ☐ | |
| 5.2 | `/intake/new` — create a test lead (fake name/phone/DOI) | ☐ | ☐ | ☐ | |
| 5.3 | Open the lead → **Mark contract sent** → status updates | ☐ | ☐ | ☐ | |
| 5.4 | **Mark signed** → status updates | ☐ | ☐ | ☐ | |
| 5.5 | **Open matter** → you land on `/cases/[id]` for that matter | ☐ | ☐ | ☐ | |
| 5.6 | Optional: open a seed lead (if listed) and skim contact attempts | ☐ | ☐ | ☐ | |

**Intake overall:** ☐ Usable for rehearsal · ☐ Blockers: _______________

---

## 6. Phase 7 queues — look only (~5 min)

Skeletons only. **Do not expect** Kate/Emily/Daniel action buttons yet — those wait on your screen sign-off in `PHASE7_SCREEN_PROPOSALS.md`.

| # | Try this | Pass | Fail | Skip | Notes |
|---|---|---|---|---|---|
| 6.1 | `/demands` loads (empty list is OK) | ☐ | ☐ | ☐ | |
| 6.2 | `/liens` loads (empty list is OK) | ☐ | ☐ | ☐ | |
| 6.3 | `/review` loads (empty list is OK) | ☐ | ☐ | ☐ | |
| 6.4 | Read `docs/PHASE7_SCREEN_PROPOSALS.md` and mark Approved / Notes / Rework there | ☐ | ☐ | ☐ | |

---

## 7. Explicitly out of scope (do not treat as bugs)

| Item | Status |
|---|---|
| Live e-sign / DocuSign send from Intake | Not built — stub status only |
| AI / OCR on medicals | Deferred (your decision) |
| Live Outlook / Google calendar sync | Deferred (your decision) |
| Full mockup parity (every card / pizza tracker / discovery) | Incremental after this review |
| Real CasePeer client load | Owner-run later; needs BAA |

---

## Your verdict (copy into audit or return this page)

```
Tester: Michael Tuttle
Date: ________
App build / URL used: http://127.0.0.1:3000

Overall direction (phases 0–10 as demoed)
  ☐ Approved   ☐ Approved with notes   ☐ Pause / rework

Biggest gap for daily firm use:
________________________________________________

Next priority (pick one)
  ☐ Deepen Case Manager / Litigation
  ☐ Phase 7 actions after screen sign-off
  ☐ CasePeer rehearsal (after BAA)
  ☐ Other: _______________

Bugs / UX notes (bullet freely):
-
-
-

Signed: ____________________________
```

---

## Related docs

| Doc | When |
|---|---|
| `docs/OWNER_PROJECT_AUDIT.md` | Formal approval checkboxes |
| `docs/PHASE7_SCREEN_PROPOSALS.md` | Kate / Emily / Daniel screens |
| `docs/PROJECT_PHASES.md` | Full phase map |
| `mockups/*.html` | Clickable “ideal” behavior (aspirational vs MVP) |

*If something fails, note the URL + what you clicked + what you saw. Screenshots help.*
