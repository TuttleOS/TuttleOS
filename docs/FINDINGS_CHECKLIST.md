# Workflow Findings Checklist (F-01 → F-55)

**Source:** [claude workflow-findings-2026-07-19.md](file:///Users/iohmarketing/Dropbox/TUTTLEOS/claude%20workflow-findings-2026-07-19.md)  
**Checked against:** Tuttle OS kit (`web/`, `sql/`, `docs/`) as of **2026-07-20**  
**Note:** Findings doc was written against schema v2.5; kit has since advanced (contracts, documents, minors, etc.). Treat this as a living backlog.

---

## Legend

| Status | Meaning |
|---|---|
| **DONE** | In product and usable for the finding’s core intent |
| **PARTIAL** | Some schema and/or UI exists; gap vs finding remains |
| **DESIGNED** | Schema and/or design docs exist; feature not built |
| **NOT STARTED** | No meaningful implementation yet |

| Priority | From findings doc |
|---|---|
| **P1** | Before go-live |
| **P2** | Early post-launch |
| **P3** | Structure / deferred |
| **AD** | Already designed (verify only) |

---

## Scoreboard

| Status | Count |
|---|---|
| DONE | 3 |
| PARTIAL | 24 |
| DESIGNED | 17 |
| NOT STARTED | 11 |
| **Total** | **55** |

---

## A. Intake, contract & client structure

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-01 | P1 | PARTIAL | Minor + parent; parent always a client | Case A/B capacity exists; **align with “parent = full client + own matter”** (Michael call) |
| F-02 | P1 | DESIGNED | Wrongful death contract / decedent | Need decedent person + WD template variant |
| F-03 | AD | DONE | Multi-client crash (`incident_group`) | Keep verifying companion strip edge cases |
| F-04 | P1 | PARTIAL | Conflict waiver workflow | Links/chips exist; no generate/sign tracking |
| F-05 | P1 | PARTIAL | Contract template matrix (variant × EN/ES) | One EN template + capacity language; no ES / WD matrix |
| F-06 | P1 | PARTIAL | Tier-1 / Tier-2 intake + CM handoff | Six-minimums only; no Tier-2 → welcome-call agenda |
| F-07 | P1 | DESIGNED | Injury inventory + TBI screen | `medical.injury` / `is_tbi`; no intake checklist UI |
| F-08 | P1 | PARTIAL | TBI → attorney escalation | Badge exists; no disposition queue |
| F-09 | P1 | DESIGNED | Lost-wages screening | `wage_loss` table; no intake UI |
| F-10 | P2 | NOT STARTED | Visible-injury photo progression | — |
| F-11 | P1 | PARTIAL | Referral source required | Free-text marketing only; need typed + linkable source |

---

## B. Intake media

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-12 | P2 | PARTIAL | Multi-channel photo/doc capture | Staff documents upload; no SMS-forward / unassigned inbox |
| F-13 | P2 | NOT STARTED | Client upload link | — |

---

## C. Assignment & staffing

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-14 | P1 | NOT STARTED | Weighted language-aware CM rotation | Manual assign only |

---

## D. Sign-up automations

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-15 | P2 | NOT STARTED | Welcome text on signature | Needs automation framework |
| F-16 | P1 | NOT STARTED | Referral facility picker (PONS default) | — |
| F-17 | P2 | NOT STARTED | Referral packet to facility | — |

---

## E. Early case work

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-18 | P1 | NOT STARTED | Welcome call = Tier-2 gaps | — |
| F-19 | AD/P2 | PARTIAL | Claim opening / LOR | Checklist + DB hooks; limited claim open UI |
| F-20 | P2 | NOT STARTED | Carrier intelligence KB | — |
| F-21 | P1 | DESIGNED | CMS / lien inquiry early | Lien schema; `/liens` skeleton |

---

## F. Property damage & LOU

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-22 | AD | DONE | PD first fire / demand blocker | Optional: first-party permission talking point |
| F-23 | P2 | DESIGNED | Loss of use engine | Columns parked; no LOU UI/compute |

---

## G. Medical treatment

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-24 | AD | DONE | Treatment monitoring / provider calls | Optional: days-since-DOI no first appt flag |
| F-25 | P1 | NOT STARTED | Future medicals verification | — |
| F-26 | P3 | DESIGNED | AI records extraction | Parked AI layer; fields empty until pipeline |

---

## H. Records & bills

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-27 | P1 | PARTIAL | Dual records + billing requests | Types exist; not one-click dual fire |
| F-28 | P1 | PARTIAL | §18.001 affidavits with requests | Clocks/tables; no auto packet generation |
| F-29 | P1 | PARTIAL | Weekly respawning follow-ups | Due dates; no 7-day respawn chain |
| F-30 | P2 | PARTIAL | HIPAA one-click attach | Checkbox only |
| F-31 | P1 | DESIGNED | Records invoices → expenses | FK exists; no log-invoice UI |
| F-32 | P2 | NOT STARTED | >20% balance variance flag | — |

---

## I. Demand & negotiation

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-33 | P1 | PARTIAL | Demand response deadline dual-calendared | Field/UI; no Kate+CM dual watch |
| F-34 | P1 | PARTIAL | Proof of transmission multi-channel | Method/confirm; not full proof artifacts |
| F-35 | P1 | PARTIAL | Verify adjuster receipt task | Flag only |
| F-36 | P1 | NOT STARTED | 3-day counter task (CM + Kate) | — |
| F-37 | P1 | PARTIAL | Negotiation ledger | Ledger UI; add `time_request` type |
| F-38 | P2 | NOT STARTED | Attorney negotiations board | — |

---

## J. File-suit decision & handoff

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-39 | P1 | NOT STARTED | File-suit memo | — |
| F-40 | P1 | NOT STARTED | Suit authorization atomic event | — |
| F-41 | P2 | NOT STARTED | Client filing confirmation | — |
| F-42 | P1 | NOT STARTED | Paralegal challenge / filing concern | — |
| F-43 | P1 | PARTIAL | Dual-track (lit while treating) | Switcher exists; no STILL TREATING banner |

---

## K. Litigation workflow

| ID | Pri | Status | Finding (short) | Gap / next |
|---|---|---|---|---|
| F-44 | P1 | DESIGNED | Filing prep chain | Lit MVP; no file-stamped gate chain |
| F-45 | P1 | NOT STARTED | Defendant workup checklist | — |
| F-46 | P1 | PARTIAL | Outbound discovery timing (TRCP 192.2) | Answer/disclosures; no serve-permitted clock |
| F-47 | P1 | DESIGNED | Inbound discovery + client loop | Tables/tasks; no client-loop UI |
| F-48 | P1 | DESIGNED | Rule 11 agreement registry | No first-class table/UI |
| F-49 | P2 | DESIGNED | Plaintiff depo prep chain | Designed; not built |
| F-50 | P2 | PARTIAL | Expert designation workflow | Deadlines; no designation from episodes |
| F-51 | P1 | DESIGNED | Pending-motion flag | `motion` table; no flag/UI |
| F-52 | P2 | DESIGNED | Default judgment path | Designed; not actionable |
| F-53 | P1 | DESIGNED | Litigation expenses at event | `case_expense` exists; no prompts |
| F-54 | P2 | DESIGNED | Settlement lit dismissal sequencing | Partial settlement/lien skeletons |
| F-55 | P2 | PARTIAL | Monthly client contact in lit | 30d flag view; no monthly recurring task |

---

## Suggested incorporation order

1. **Policy lock with Michael:** F-01 (parent always client?), F-04 (waiver timing), F-05 (ES templates), open questions in findings doc  
2. **Finish intake/contract P1 slice:** F-01 alignment · F-05 variants · F-11 referral · F-06 Tier-2 sketch  
3. **Sign-up spine:** F-14 rotation · F-16 facility · automation framework (unblocks F-15/F-17)  
4. **CM medical/records P1:** F-25 · F-27/F-28/F-29 · F-21 liens inquiry  
5. **Demand P1:** F-33–F-37  
6. **File-suit / lit P1:** F-39–F-46 · F-51 · F-53  

---

## Open Michael decisions (from findings)

- [ ] F-01 — Confirm Case B: parent always gets own matter/contract?  
- [ ] F-04 — Waiver with contract or later? Driver+passenger always?  
- [ ] F-15 — One SMS or two?  
- [ ] F-17 — Include preferred language in referral packet?  
- [ ] F-22 — Carve PD to client? Rental/GAP tracking?  
- [ ] F-49 — Depo prep lead time (7–10 days)?  
- [ ] F-14 — Paralegal day-one: rotate or manual?  

---

## Prompt for Claude — Michael status report

Copy everything inside the box into Claude (with this checklist + the findings doc attached or in context).

```
You are preparing a short owner briefing for Michael (Tuttle Law / Crash Guy) on the July 19, 2026 workflow findings (F-01–F-55) vs what is actually built in Tuttle OS.

INPUTS (use these as source of truth):
1. docs/FINDINGS_CHECKLIST.md — status per finding (DONE / PARTIAL / DESIGNED / NOT STARTED)
2. Dropbox: claude workflow-findings-2026-07-19.md — original intent, priorities, open questions
3. Optionally: recent git / product notes if provided in the chat

AUDIENCE: Michael — attorney/owner. Not a developer dump.
TONE: Direct, plain English, decision-oriented. No jargon unless necessary; if you use a term (e.g. incident_group), say it once in plain words.
LENGTH: Aim for 1–2 pages equivalent. He should be able to skim in under 5 minutes.

OUTPUT STRUCTURE (use these exact headings):

# Tuttle OS — Findings progress for Michael
Date: [today]

## 1. Bottom line
3–5 bullets: where we stand overall; what blocks go-live from THIS findings list; what’s already working that he can rely on.

## 2. Scoreboard
Table or bullets: counts of DONE / PARTIAL / DESIGNED / NOT STARTED. Call out P1 only totals if useful.

## 3. What’s already in good shape
Only findings that are DONE or strong PARTIAL. One line each: finding ID + what he gets in the product today.

## 4. Decisions we need from you
Only open policy questions that unblock build. For each:
- Finding ID + plain-language question
- Why it matters (1 sentence)
- Recommended default if he doesn’t care (optional)

Must include F-01 (parent always a client / own matter vs guardian-signs-only), F-04 conflict waiver timing, and any other unchecked items from the checklist’s “Open Michael decisions” section.

## 5. Recommended next build order (P1 first)
Numbered list of 5–8 concrete next slices, mapped to finding IDs. Prefer intake/contract → sign-up → CM medical/records → demand → file-suit/lit. Skip P2/P3 unless they unblock a P1.

## 6. Risks / mismatches
Call out tensions between the findings doc and current build (especially F-01 Case A/B vs “parent always a client”). Be explicit: proposed-only findings are not live schema.

## 7. Ask
End with one clear ask: which decisions he wants to lock this week, and whether to proceed with the recommended order.

RULES:
- Do not invent status; if unsure, say PARTIAL or UNKNOWN and why.
- Do not propose schema DDL in this report unless he asks.
- Prefer finding IDs (F-01) so we can track answers back to the checklist.
- If something is DESIGNED but not built, say “designed in the database / docs, not in the screens yet.”
```

After Claude drafts the report: paste Michael’s answers back into the **Open Michael decisions** checkboxes above and update finding statuses when build catches up.

---

*Update this file when a finding moves status. Do not treat the Dropbox findings doc as applied schema.*
