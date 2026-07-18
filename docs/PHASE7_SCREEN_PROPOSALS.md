# Phase 7 — Screen proposals for owner sign-off

**Status:** Skeletons shipped (read-only queues). **STOP here** until Michael approves the screens below.  
Do **not** invent Kate / Emily / Daniel workflows without this sign-off (`MASTER_PROMPT` §7.7 · `COMPLIANCE_GATES` 7.1–7.3).

Live skeletons (empty until matching stage/data exists):

| Route | Data source | Role home |
|---|---|---|
| `/demands` | `resolution.v_demand_readiness` | `demand_writer` |
| `/liens` | `liens.v_lien_worklist` | `lien_disbursement` |
| `/review` | `workflow.viability_review` (open) | `senior_paralegal` (also touches Owner) |

---

## 1. Demand Writer (Kate)

**Proposed primary screen:** Demand readiness board  
- Columns: client, Level, treatment complete, records outstanding, PD clear, Kate reviewed, attorney approval (L3).  
- Row click → matter CM view (`/cases/[id]`) with a Demand card focus (future).  
- Actions (needs design): Mark Kate-reviewed · Request missing records · Draft demand · Send demand · Escalate L3 to attorney.

**Open questions for Michael**
1. Is the readiness view the *only* queue, or also “sent / awaiting response”?  
2. Who owns PD blockers before Kate can mark ready?  
3. Stowers / time-limited demand — same queue or separate tab?  
4. Should draft text live in Dropbox only until Phase 8 documents?

---

## 2. Lien & Disbursement (Emily)

**Proposed primary screen:** Open lien worklist  
- Columns: client, lien type, holder, status, asserted $, matter settled?, flagged date.  
- Sorted settled-first (matches DB view).  
- Actions (needs design): Verify amount · Negotiate · Resolve/waive · Flag for disbursement · Open trust worksheet (finance tier).

**Open questions for Michael**
1. Disbursement sheet — separate workspace tab or only from settled matters?  
2. Medicare / ERISA special flows — same worklist with badges, or dedicated queues?  
3. Who may edit negotiated amounts (Emily only vs attorney co-sign)?

---

## 3. Senior Paralegal Review (Daniel)

**Proposed primary screen:** Open 7-day viability reviews  
- Columns: client, due (overdue red), prep status, CM recommendation + Level, stage.  
- Actions (needs design): Accept · Accept with conditions · Needs more info · Reject — writing `reviewer_decision` / `reviewed_by` / `reviewed_at`.

**Open questions for Michael**
1. Does Daniel also own a “second look” queue beyond viability (e.g. demand QC)?  
2. Conditions text — freeform only, or structured checklist?  
3. After accept, auto-advance stage to treating — confirm DB trigger vs UI button.

---

## 4. Explicitly out of scope until signed

- Inventing email/SMS cadences  
- Fake “AI draft demand” (owner: **no AI in the project yet** — Phase 8 AI deferred)  
- Hard-coding dropdowns outside `ref.*`  
- Finance UI beyond what RLS already allows  

---

## Sign-off

```
Owner: Michael Tuttle
Date: ________
Demand Writer proposal:  ☐ Approved as-is  ☐ Approved with notes  ☐ Rework
Lien / Disbursement:     ☐ Approved as-is  ☐ Approved with notes  ☐ Rework
Senior Review:           ☐ Approved as-is  ☐ Approved with notes  ☐ Rework
Notes:
________________________________________________
```

After sign-off, engineering opens a Phase 7.1 ticket per role with Playwright bars.
