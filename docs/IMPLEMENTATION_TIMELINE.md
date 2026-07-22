# Tuttle OS — Implementation timeline

**Prepared:** 2026-07-22 · For Michael discussion  
**Sources:** Dropbox `ui-design-decisions_1.md`, `tuttle-os-7-day-plan_1.md`, `docs/FINDINGS_CHECKLIST.md`, security roadmap map, current kit state  

**Canvas (visual):** [implementation-timeline.canvas.tsx](/Users/iohmarketing/.cursor/projects/Users-iohmarketing-TuttleOS/canvases/implementation-timeline.canvas.tsx)

---

## North star (unchanged)

One app · role workspaces · RLS is the gate · data capture follows the workflow · dates always include year · status indicators are links · healthy cases stay off the screen (management by exception).

---

## Phase 0 — This week (ops / safety)

| When | Change | Owner | Notes |
|---|---|---|---|
| ASAP | Run `sql/19` in Supabase SQL Editor → Rerun Security Advisor | Eng / Michael | Clears 3 RLS / security-definer errors |
| ASAP | Sync Jul 22 **CM work queues** section into repo `docs/ui-design-decisions.md` | Eng | Merge Dropbox → docs; don’t blind-overwrite |
| Before real PHI | Supabase BAA (+ Vercel BAA as counsel requires) | Michael | Hard stop — see COMPLIANCE_GATES |

---

## Phase 1 — CM work queues sprint (~1 week · 2 hrs/day plan)

**Goal:** five derived assembly-line queues in Case Manager. **No new schema** for this slice.

| Day | Ship | Depends on |
|---|---|---|
| Day 1 | Baseline check (DB + fictional data + branch `cm-work-queues`) + STATUS map | — |
| Day 2 | Queues **New cases** + **LORs pending** + deep-links + Playwright | Day 1 |
| Day 3 | Queues **Liability** + **PD** + **Records** | Day 2 |
| Day 4 | Hard test → merge to production | Days 2–3 green |
| Day 5 | **Decision day** (not code): past-SOL list, migration 8 decisions, ATTORNEY-VERIFY / BAAs triage | Michael + Claude |
| Day 6 | New-case notification (Today strip + activity) + top STATUS fixes | Queues live |
| Day 7 | Ship Day 6 · regression · pick Track A / B / C for next week | — |

**Queue rules (Michael 2026-07-22):** derived rows · live counts · deep-link = expand + scroll + highlight · complement Today/Pipeline · don’t replace them.

---

## Phase 2 — Next track (pick one after Day 7)

| Track | What | Gate |
|---|---|---|
| **A — Kate Demand Writer** | Spec session with Michael first; no inventing her workflow | Owner sign-off on screens |
| **B — Documents + AI path** | BAAs → adopt storage/AI scripts deliberately · pilot **one closed** case | L1/L3 BAAs · Phase 8 gates |
| **C — Migration cutover prep** | Day 5 decisions done · refresh CasePeer exports · rehearse load | BAA + fictional→real gate |

---

## Phase 3 — Intake / contract alignment (parallel or after queues)

| Priority | Change | Finding / note |
|---|---|---|
| P1 | Lock **F-01** with Michael: parent always a client + own matter? vs current Case B | Blocks more minor/contract work |
| P1 | Contract template matrix (adult / on-behalf / WD × EN/ES) | F-05 |
| P1 | Conflict waiver workflow behind companion chip | F-04 |
| P1 | Referral source typed + required | F-11 |
| P2 | Preferred language Tier-1 / Spanish contracts | F-05 / F-14 |

---

## Phase 4 — Sign-up & CM depth (post-queues)

| Change | Finding |
|---|---|
| Weighted CM rotation + language routing | F-14 |
| PONS / referral facility picker | F-16 |
| Welcome text + facility packet (after automation framework) | F-15, F-17 |
| Welcome call = Tier-2 gap agenda | F-06, F-18 |
| Dual records/bills + §18.001 packet + weekly follow-ups | F-27–F-29 |
| Future medicals verification | F-25 |

---

## Phase 5 — Demand → file-suit → lit additions

| Band | Items |
|---|---|
| Demand P1 | Response deadline dual-watch, transmission proof, receipt verify, 3-day counter, ledger `time_request` (F-33–F-37) |
| File-suit P1 | Memo, suit_authorized event, filing concern, still-treating banner (F-39–F-43) |
| Lit P1 | Filing prep chain, defendant workup, TRCP 192.2 serve clock, motions flag, expense prompts (F-44–F-46, F-51, F-53) |

---

## Phase 6 — Go-live / real data (not a calendar day — a gate pack)

From `COMPLIANCE_GATES` + security roadmap:

1. BAAs (Supabase, Vercel, firm arrangement)  
2. MFA enforced for staff  
3. PHI-safe logging + secrets audit  
4. Tested backups / PITR  
5. Risk assessment + policies (firm)  
6. Pen test on public `/sign`  
7. CasePeer load only after the above  

---

## Explicitly later / parked

| Item | Status |
|---|---|
| Punch card (developer hours) | Parked — Cursor canvas only |
| Theme (Crash Guy Bold vs Parchment) | Awaiting Michael brand |
| SOC 2 Type II | Optional decide |
| AI enrich on live PHI | Behind BAAs + Phase 8 |

---

## Ask Michael in the room

1. Approve **Phase 1** (CM queues week) as next ship?  
2. Who runs Cursor day-to-day — builder, Michael, or both?  
3. Book **Day 5** decision block on the calendar?  
4. Prefer next week **A / B / C**?  
5. Lock **F-01** (parent as full client) now or after queues?  

---

*Update this file when a phase ships. Visual twin: implementation-timeline canvas.*
