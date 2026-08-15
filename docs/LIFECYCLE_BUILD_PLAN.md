# Tuttle OS — Case Lifecycle Build Plan

**Status:** Canonical sequencing plan (adopted 2026-08-09)  
**Source:** Claude session output `BUILD_PLAN.md` (from lifecycle plan PDF prompt)  
**Companions:** `CLAUDE_PROMPT_LIFECYCLE_FLOW_VS_BUILD.md` (full scored inventory) · `BUILD_PRIORITY_REVIEW_TODOS.md` (Stage 0–6) · `CM_BETA_RUNBOOK.md` (Stage 3) · `FINDINGS_CHECKLIST.md`

---

## 1. What this is

**This plan is** a sequencing map: which lifecycle gaps to close, in what order, without disturbing work that already runs on preview.

**This plan is not** a rebuild brief, a reason to delay the case-manager beta, or a licence to rewrite working screens. Nothing here re-scores the audit; every status is copied from the scored inventory.

> **The read.** Stages 0–2 — roles, property-damage integrity and the dashboards — are the green spine. Almost no blocking gate is fully built. Stage 3 CM beta ships with known amber and red gaps. This is lifecycle truth and sequencing, not a stop order.

**Legend, used throughout**

| Status | Meaning |
|---|---|
| BUILT | Enforced in code or database. For a gate, that means server-side, not the interface alone. |
| PARTIAL | Present but incomplete, or enforced only in the interface where a gate is required. |
| MISSING | Not implemented. |
| DEFERRED | Deliberately out of scope for now. Not a failure. |

The full 83-row inventory lives in the companion scoreboard / `CLAUDE_PROMPT_LIFECYCLE_FLOW_VS_BUILD.md`. This document carries the scoreboard, the gates, and the handoffs only.

---

## 2. Non-negotiable rules

1. **Stage 3 first.** The CM beta, Michael's sign-off, and the merge gate are the near-term track. Lifecycle work does not rip up preview.
2. **Additive only.** Soft delete, new columns and migrations, new actions. No rewrite of working property damage, negotiation, or role-partition code.
3. **Consult before overwrite.** If a change alters behaviour Michael has already accepted, touches the contract / reject / non-engagement-letter paths, changes RLS, or disturbs active demo fixtures — **stop and ask**.
4. **Branch discipline.** Work on `role-partition` or short-lived branches off it. No lifecycle work reaches `main` before Stage 3 sign-off.
5. **Score before build.** Confirm the audit ID → produce a five-line touch list → get approval → implement → smoke on preview → update the scoreboard for that ID only. No drive-by refactors.

### Hard stop-and-ask triggers

- Deleting or renaming routes, role codes, or demo accounts
- Changing contract send, reject, or non-engagement-letter behaviour
- Changing RLS or `staff_role_grant` semantics
- Replacing the Demand or Liens skeletons with a new information architecture
- Hard delete, data backfill, or migrations that rewrite existing rows
- "While I'm here" refactors outside the ticket

---

## 3. Where we are

### Scoreboard — 83 assertions

| Status | Count | Share |
|---|---|---|
| BUILT | 8 | 10% |
| PARTIAL | 49 | 59% |
| MISSING | 17 | 20% |
| DEFERRED | 9 | 11% |

Read it this way: more than half the lifecycle exists in some form but is not yet enforced. That is a different problem from missing features, and it is cheaper to fix — most PARTIAL rows need a server-side check added to something already on screen, not new screens.

### Build stages

| Stage | Status | Maps to |
|---|---|---|
| 0 · Foundation | Done on preview | Lanes, demo logins, P1 consolidation (0 of the July 19 P1 items fully done) |
| 1 · Data integrity | Done on preview | PD edit / remove / photos, negotiation directionality, coverage "No treatment" |
| 2 · Role dashboards | Done on preview | Needs-attention boards, CM and litigation queues |
| 3 · CM beta | **Locked 2026-08-15:** Mark (1 CM) · stagger lit · preview only · demo data | Do **not** merge; pilot on preview URL |
| 4 · Settlements / disbursement | Not started | Liens finance sequence, GATE-10 |
| 5 · Litigation rollout | Proposed stagger after CM | Defendant workup, FILED stamp, suit authorization |
| 6 · Migration | Last | After the schema settles |

Preview: https://tuttle-os-git-role-partition-tuttle-os.vercel.app · PR: https://github.com/TuttleOS/TuttleOS/pull/1

---

## 4. Lifecycle snapshot by lane

Each lane's principal nodes with their scored status. Read left to right as the case moves.

| Lane | Nodes and status |
|---|---|
| **Intake** | Lead queue BUILT · Six minimums PARTIAL · contract_signed event PARTIAL · Non-engagement letter PARTIAL |
| **Case manager** | 9-task sign-up PARTIAL · Treating cadence PARTIAL · Records & bills PARTIAL · Futures MISSING · Demand blockers PARTIAL · Package to Kate PARTIAL · Standing duties PARTIAL · Coverage boxes PARTIAL · 3-day counters MISSING · Dual-track banner PARTIAL (banner live; calendaring open) |
| **Demand writer** | Package quality gate DEFERRED · 14-day clock MISSING · Level 3 hold PARTIAL · Transmission proof PARTIAL · Negotiation ledger BUILT |
| **Litigation** | Defendant workup MISSING · FILED stamp MISSING · Service chains PARTIAL · Answer clocks PARTIAL · Discovery and trial PARTIAL · SOL watchlist PARTIAL · Depo READY DEFERRED |
| **Liens & disbursement** | Liens day one PARTIAL · Medicare clock MISSING · Release to trust DEFERRED · Dismissal gate DEFERRED · Disburse and close DEFERRED |
| **Attorney** | Viability / conflict / Level PARTIAL · Level 3 approval PARTIAL · Suit authorization MISSING · Petition & defaults MISSING · Settlement advice MISSING · ATTORNEY-VERIFY PARTIAL · Raise concern MISSING |

The shape to notice: intake through negotiation is a continuous amber band — drawn correctly, not yet enforced. The only green node in the negotiation path is the negotiation ledger, which is also the newest work. That is the pattern to repeat.

---

## 5. Phased plan

### Phase 0 — Freeze and protect

| Step | Action |
|---|---|
| 0.1 | Treat `role-partition` and PR #1 as the protected baseline |
| 0.2 | Do not reopen Stage 0–2 done items unless a real bug is reported |
| 0.3 | Keep the flowchart and scoreboard as planning maps, not a rebuild brief |
| 0.4 | Michael confirms Stage 3 — **done 2026-08-15:** Mark (1 CM), stagger, preview only, preview+demo |

**Exit condition:** met. Known-gaps sheet sent; Mark morning-list smoke passed 2026-08-15.

### Phase 1 — Decision gate before high-risk build

Policy must not be invented in code for any of these. They wait on Michael:

- **F-01 / F-04 / F-05** — minor and parent structure, conflict-waiver workflow, contract variant matrix. These set the depth of GATE-01.
- **F-14** — CM rotation and Spanish-language routing.
- **Audit open questions** — Daniel's authority, administrator holder, UM/UIM owner, friendly-suit owner, dual-track tie-breaker, photo-reminder stop condition, unassigned media owner.

### Phase 2 — Safe slices

Ordered lowest overwrite risk to highest, and CM-adjacent before litigation or settlement.

#### Track A — Harden what exists (lowest risk)

| # | Item | Note |
|---|---|---|
| 1 | GATE-02 — confirm the non-engagement letter hard-blocks close | Add a server refusal only if one is genuinely missing |
| 2 | GATE-11 — coverage boxes | A louder warning is fine; **consult** before blocking stage advance |
| 3 | N-CM-08 — CLIENT STILL TREATING banner | **Done 2026-08-15** — additive banner on CM + Lit matter |
| 4 | Apply `21_upgrade_v2.20_negotiation_directionality.sql` on Supabase | Additive CHECK; the application already validates |

#### Track B — Case-manager package spine

| # | Item | Note |
|---|---|---|
| 5 | GATE-04 — package-level refusal built from the existing blocker flags | Do not rebuild the Demand UI |
| 6 | GATE-03 / F-25 — futures amount and procedure, or a documented "no futures" | **Consult on schema** |
| 7 | N-CM-03 / F-27–29 — one-click packet and 7-day respawn | **Consult** — large surface; may stay deferred until after CM beta |

#### Track C — Intake handoff (needs Phase 1 decisions)

| # | Item | Note |
|---|---|---|
| 8 | GATE-01 depth — EN/ES, wrongful death, and minor variants | Blocked on F-05 |
| 9 | H-01 — welcome text, assignment, checklist spawn | **Consult** on automatic versus manual CM assignment |

#### Track D — Demand and Kate (walkthrough-gated)

| # | Item | Note |
|---|---|---|
| 10 | GATE-05 / GATE-06 — transmission proof required, Level 3 hold on send | |
| 11 | H-07 / F-36 — 3-day counter task on CM and Kate | |

**Rule:** do not build Kate's full screens before her walkthrough. Keep the skeleton.

#### Track E — Litigation and suit (Stage 5)

| # | Item | Note |
|---|---|---|
| 12 | ATT-03, H-08, H-09, GATE-07, GATE-08 | Only after the CM beta is stable |

#### Track F — Liens and settlement (Stage 4)

| # | Item | Note |
|---|---|---|
| 13 | H-13, H-14, GATE-10, N-LD-03, N-LD-04 | The last product track before migration |

---

## 6. Anti-break checklist

Run every ticket through this. One box per ticket, no exceptions.

1. **Name the audit IDs** the ticket addresses — for example GATE-04.
2. **List the files and tables that will change.** If that list touches many hot paths, or any RLS policy or migration, pause for approval before writing code.
3. **State the additive plan,** and call out explicitly any behaviour change to a button that already works.
4. **A human approves the touch list** before implementation starts.
5. **Build on the branch** → smoke on preview → update the scoreboard and findings **for that ID only**.
6. **Commit and push only when asked.**

---

## 7. Blocking gates

| ID | Gate | Status | Gap |
|---|---|---|---|
| GATE-01 | Six minimums block contract send | PARTIAL | Full ES / WD / minor variant matrix |
| GATE-02 | Rejection incomplete until NEL sent | PARTIAL | Confirm hard close on all paths |
| GATE-03 | Futures before records clear | MISSING | No futures gate |
| GATE-04 | Demand-ready while blockers open | PARTIAL | No package-level refusal |
| GATE-05 | Demand sent needs channel proof | PARTIAL | No artefact-required gate |
| GATE-06 | Level 3 needs attorney approval | PARTIAL | Send is not server-blocked |
| GATE-07 | Defendant workup before filing prep | MISSING | No workup gate |
| GATE-08 | FILED only on file-stamped copy | MISSING | No stamp completion gate |
| GATE-09 | Plaintiff deposition READY | DEFERRED | P2 |
| GATE-10 | Dismissal until funding confirmed | DEFERRED | Stage 4 |
| GATE-11 | Coverage = provider or No treatment | PARTIAL | Does not refuse advance |

## 8. Handoffs

| ID | Transition | Status | Gap |
|---|---|---|---|
| H-01 | Intake → CM on contract_signed | PARTIAL | Welcome · packet · rotation · 9-task auto |
| H-02 | Intake → closed (reject + NEL) | PARTIAL | GATE-02 hard close |
| H-03 | WD / minor / L3 / conflict → Attorney | PARTIAL | No disposition queue |
| H-04 | CM → Demand Writer | PARTIAL | GATE-04 plus the 14-day clock |
| H-05 | Demand → Attorney, Level 3 | PARTIAL | GATE-06 hold on send |
| H-06 | Demand → carrier | PARTIAL | Dual calendar and proof |
| H-07 | Carrier response → 3-day CM + Kate | MISSING | No dual task |
| H-08 | File-suit memo → Attorney | DEFERRED | F-39 |
| H-09 | suit_authorized → four effects | DEFERRED | F-40 |
| H-10 | Paralegal concern → Attorney | MISSING | No concern queue |
| H-11 | Petition filed → service chains | PARTIAL | GATE-07 / GATE-08 |
| H-12 | CM ↔ Litigation dual-track | PARTIAL | Banner live; tie-breaker open |
| H-13 | Settle → Liens | DEFERRED | Stage 4 |
| H-14 | Liens → closed | DEFERRED | UM/UIM owner open |

---

## 9. Top 10 gaps

Ranked by malpractice, money, and wrong-entity risk — not by effort.

| Rank | ID | Gap | Why it ranks here |
|---|---|---|---|
| 1 | GATE-03 | Futures | The future-medical figure is a damages element that cannot be recovered once the demand has gone out. No gate exists at all. |
| 2 | GATE-04 | Demand-ready blockers | A package can be sent to Kate with liens unscreened or Level missing, which puts the anchor number at risk. |
| 3 | GATE-07 | Defendant workup | Nothing prevents a petition naming the wrong legal entity. |
| 4 | GATE-08 | FILED stamp | A case can read as filed when the clerk never accepted it. |
| 5 | H-01 | Intake → CM automation | The matter is created, but welcome text, referral packet, rotation and the checklist do not fire. Every one is a manual step someone can forget. |
| 6 | H-07 | 3-day counters | Negotiation tempo currently depends on someone remembering. |
| 7 | N-CM-08 | Dual-track banner | Banner is live on CM + Lit matter. Calendaring of 18.001 / discovery / plaintiff depo still does not change automatically (tie-breaker open). |
| 8 | ATT-03 | Suit authorization | The four atomic effects do not fire, so the handoff into litigation is entirely manual. |
| 9 | GATE-05 / 06 | Proof and Level 3 hold | A demand can show as sent without proof, and a Level 3 demand can go out on an on-screen notice alone. |
| 10 | Stage 4 | H-13 / H-14 / GATE-10 | Settlement to disbursement does not exist yet. Nothing prevents a nonsuit before funding confirms, and that has no undo. |

---

## 10. What the CM beta can ship past

These are deliberate scope decisions or downstream of the pilot. Document them as known gaps, not failed checks.

- Kate's full demand screens — DEFERRED pending her walkthrough
- Liens finance and disbursement UI — Stage 4
- File-suit memo and suit authorization — Stage 5
- GATE-07, GATE-08, and most litigation depth
- One-click records packet and the full respawn engine — consult before building; this may wait
- Clearing all 83 audit rows

**What the pilot still needs honesty about:** incomplete GATE-01 variants, no futures gate, incomplete package refusal, and dual-track calendaring (banner is live; dates do not auto-change). Case managers in the pilot should be told these are known, not discover them.

---

## 11. Open questions for Michael

- [x] Stage 3 — **Mark Garza (1 CM)**, stagger lit, preview only, preview+demo (2026-08-15). Swap/add CMs later is allowed.
- [ ] F-01 — minor and parent matter structure
- [ ] F-04 — conflict-waiver workflow
- [ ] F-05 — contract variant matrix, EN/ES × standard / minor / WD
- [ ] F-14 — CM rotation and Spanish-language routing
- [ ] Daniel's authority — which attorney decisions he may issue alone
- [ ] Administrator role holder
- [ ] UM/UIM sequencing owner
- [ ] Friendly-suit logistics owner
- [ ] Dual-track tie-breaker
- [ ] Photo-reminder stop condition
- [ ] Unassigned media pen default owner

---

## 12. The next decision

Stage 3 shape is **locked** (preview-only, 1 CM, demo). Merge to `main` is **off** until a later “CMs may use prod.”

| Now | Meaning |
|---|---|
| **Run the preview pilot** | Mark uses preview + `cm.demo` · known-gaps sent · morning list passed 2026-08-15 |
| **Optional Track A** | Safe harden on `role-partition` during the preview week (does not touch production) |

Do not start Tracks B–F without a consult. Do not merge PR #1.
