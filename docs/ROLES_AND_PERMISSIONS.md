# Tuttle OS — Roles & Permissions

**Source of truth for job duties and access intent.** Reconciled against the current build on 2026-07-27.

- Section map / route inventory: [PROJECT_SECTIONS_BY_ROLE.md](PROJECT_SECTIONS_BY_ROLE.md)
- Demo logins: [ROLE_TEST_ACCOUNTS.md](ROLE_TEST_ACCOUNTS.md)
- RLS detail: [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md) · [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md)

**Rule:** nav locks are a hint. **Postgres RLS is the gate.** UI must never grant what the DB forbids.

**Derivation:** duties below come from the Tuttle Role Job Descriptions (2026-07-19). Where the build and the JD disagree, the JD is controlling and the difference is listed in [§8 Action required](#8-action-required).

---

## 1. Role registry

| `role_code` | Role | Held by | Home | Caseload scope |
|---|---|---|---|---|
| `intake` | Intake Specialist | Michael, Daniel, or an assigned CM (rotating) | `/intake` | Leads world |
| `case_manager` | Case Manager | Mark Garza (1.0), Christina Calderon (1.0), Emily Schuler (0.5) | `/cases` | Assigned only |
| `demand_writer` | Demand Writer | Kate | `/demands` | n/a — package-driven |
| `litigation_paralegal` | Litigation Paralegal | Two paralegals | `/litigation` | Assigned only |
| `attorney` | Attorney / Owner | Michael (Daniel on † items) | `/owner` | Firm-wide |
| `lien_disbursement` | Lien & Disbursement Specialist | Emily Schuler (0.5) | `/liens` | Firm-wide (settled cases) |
| `admin` | Administrator | **UNASSIGNED — see §8** | `/owner` | Firm-wide |
| `senior_paralegal` | Senior Paralegal | Daniel | `/owner` | Firm-wide nav; † unconfirmed |
| `records_clerk` | Records Clerk | **UNUSED — see §8** | none wired | n/a |

Slug note: use `lien_disbursement` everywhere. The firm doc's `lien_specialist` is deprecated.

† = capability flag (`can_approve_level`, `can_clear_conflicts`), not role membership alone.

---

## 2. Duties by role

### `intake` — Intake Specialist

Convert a phone call into a signed, correctly structured case.

- Six-minimums gate before contract send: structured legal name, valid phone (US/MX, 10-digit, stored E.164), email (waivable in person, audit-logged), DOI, location, incident basics. DOI entry produces the estimated-SOL preview.
- Tier-1 contract-blocking fields incl. **preferred language** (drives contract template + CM routing) and minor / wrongful-death status → send the correct contract variant (standard / parent-minor / WD × EN/ES). One contract per client.
- Minors: capture **both** person records (parent/guardian and minor); parent is a client and signs individually and on behalf. WD: capture decedent + beneficiary, estate-representative variant.
- Multi-client crashes: one matter per client on the shared `incident_group`; flag the conflict-waiver requirement.
- Tier-2 as time allows: injury inventory incl. explicit head-strike/TBI question, visible-injury photos, lost-wages screening, referral source (REQUIRED), pain-management facility (PONS default). Unanswered items travel to the CM welcome call.
- Media: send client upload link, forward client-texted photos to the firm intake number, clear the Unassigned Media pen daily.
- **Rejections are incomplete until the non-engagement letter is sent** — the desk's primary malpractice control.

Cadence: holding pen at zero EOD; non-engagement letters same day.
Escalates to `attorney`: WD and minor-structure questions, suspected Level 3 fact patterns, conflicts between callers from the same crash.

### `case_manager` — Case Manager

Signature → demand-ready package, then stay on through Kate, negotiation, and dual-track litigation. Primary client relationship.

Volume: ~40–50 cases / 60–65 clients per full share. Auto-rotation by weight; **Spanish-speaking clients never route to Emily**; rotation overrides = `attorney` only.

- **Sign-up week (7-day target):** welcome call completing the traveling Tier-2 agenda; 9-task checklist (HIPAA auths · open DINSCO claim · DINSCO LOR *sent* date · open PINSCO claim or document refusal · PINSCO LOR · PINSCO dec sheet · CR-3 via portal · case profile · SOL confirm); CMS query and lien identification; PIP/MedPay verified on every case unless the client refuses (documented amber, revisited).
- **Property damage:** vehicle facts with REQUIRED current location (storage clock), DINSCO-PD vs PINSCO-collision routing, lienholder/title, rental, three-state drivability for loss-of-use. PD urgency is the lever to revisit a PINSCO refusal.
- **Treating:** every treatment coverage box answered — provider or explicit N/A (missed ambulance bills become surprise liens). Provider calls on +14-day cadence, ~2-day retry on no-answer; capture reached/status/balance/next appt/clinical events (ESI/MBB by region, MRI once per body part). Gap concern or noncompliance escalates immediately.
- **Records & bills (45-day target):** one-click full packet per provider on last discharge — records request + custodian affidavit, billing request + billing affidavit, 18.001 forms travel with the requests. 7-day respawning follow-ups until the document is in file. Log provider copy invoices as expenses at receipt; investigate any balance variance over 20%. **Futures:** read pain-management records for the future-medical recommendation, capture amount + procedure; if absent, call the facility — the station cannot clear unanswered.
- **Demand → suit:** clear blockers (PD unresolved, unscreened liens, missing Level) → package to `demand_writer`. Calendar the response deadline jointly with Kate; verify adjuster receipt. Any demand response fires a 3-day counter task to both CM and Kate. Prepare the file-suit memo (jointly with Kate where a demand exists). **Level 3 facts always go to Michael.**
- **Dual-track:** keep the medical track and client relationship; jointly responsible with `litigation_paralegal`.

Always: client contact never exceeds 30 days; complete call logs from the case-bound dialer; route client-called follow-ups same day.

### `demand_writer` — Demand Writer (Kate)

Turn a demand-ready package into the firm's anchor. Turnaround: **14 days** from receipt.

- Quality-gate the package: records, bills, 18.001 affidavits, futures amount + procedure, lost wages, LOU computation with aggregator proof, PD resolution, lien screen, Level. **Flag blockers back to the CM rather than drafting around holes.**
- Draft: liability, damages model (past medicals · futures · wages · LOU · non-economics), policy-limits/Stowers posture where facts support. **Level 3 demands route to `attorney` before sending.**
- Send per the carrier's required channel; attach transmission proof **per channel** (receipt email, fax confirmation, certified tracking, portal screenshot). *Sent* is not green until proof is attached.
- Calendar the response deadline jointly with the CM; work 3-day counter tasks jointly; escalate to `attorney` by checkbox with a one-line why; log every round in the negotiation ledger.
- Co-author the file-suit memo whenever a demand exists.

### `litigation_paralegal` — Litigation Paralegal

Run the lawsuit so nothing that can be lost is lost. Today list ordered by what can be lost, not who called last. Volume: ~80–90 litigation cases / 110–115 clients across two paralegals.

- **Pickup & filing:** read the memo's *why* before drafting; disagreement goes through "Raise concern with Michael" — nothing pauses unless he says so. Defendant workup **per defendant** before filing (Comptroller taxable-entity, SOS, county DBA); save the research and sign the attestation. Petition (Level 3 plea + jury demand are defaults) → `attorney` reviews and signs → eFileTexas → log filing fee → FILED completes only when the file-stamped copy is in the file.
- **Service:** one chain per defendant — request citation → confirm received → forward to server → 5-day respawning follow-ups until the RETURN kills the loop. Every attempt logged as a narrative a judge could read; **the diligence log IS the tolling record.** A filed case stays on the SOL watchlist until the last defendant is served.
- **Returns & answers:** TRCP 99 answer date computes; TRCP 107(h) 10-day clock. Answers fire that defendant's 18.001 serve-90 / counter-120 clocks, first-answer disclosures, provisional Level-2 dates. Answer overdue → default memo to `attorney`; on his go, prepare motion + prove-up on the 18.001 affidavits + servicemember affidavit.
- **Discovery:** serve ours per defendant on the computed TRCP 192.2 date (their disclosures due = answer + 30) — never wait on receipt. Theirs in: docket, forward to client with 7-day respawning nudges, draft, verify, serve. Deficient responses: 10-day letter → conferral → MTC. Serve 18.001 affidavits inside each defendant's window; TRCP 193.5 supplementation runs the whole case. Every Rule 11 agreement in the registry with what it modifies, the new date, and the signed writing.
- **DCO → trial:** scheduling orders entered in full (11 fields + § 18.001 selector + custom rows); the engine vacates what the order supersedes and amended orders re-run it. Depositions: readiness checklists; **plaintiff depos require the completed prep chain before READY.** Experts: treating-physician designations pre-populated from treatment episodes; retained-expert decision teed to `attorney` ahead of the deadline. Motions: flag MOTION PENDING, docket the response, calendar the hearing, draft for `attorney`. Mediation and trial prep as scheduled.

Always: monthly status contact with every litigation client; log litigation expenses at the event; dismissal/nonsuit prepared **after** funding confirms, money side to `lien_disbursement`; dual-track CLIENT STILL TREATING banner changes 18.001, discovery, and plaintiff-depo calendaring — coordinate with the CM.

### `attorney` — Attorney / Owner (Michael; † shared with Daniel pending §8)

Own every decision the system refuses to automate.

- **Standing queues:** Level approvals† (a missing Level is a red blocker at every station); 7-day viability reviews†; conflict clearance† (`can_clear_conflicts`); attorney-review queue (TBI screens — disposition every one: neuro referral / monitor / clear; escalated counters; LOP approvals; paralegal filing concerns).
- **ATTORNEY-VERIFY:** every computed SOL branch (minors, WD, governmental notice) and every computed rule deadline carries his verification. Never trusted raw.
- Level 3 demand approval before Kate sends; retained-expert decisions; default go/no-go; rotation overrides†.
- **File-suit authorization** — fires paralegal assignment + landing, client intro text, confirmation task. Level 3 always crosses his desk; Level 1 rarely files absent a liability dispute.
- Petition review and signature; hearings, mediations, trial; settlement recommendations (**the client owns the settlement decision; the attorney owns the advice**); minor settlements through friendly suit / ad litem.
- Reviews: negotiations board and stalled-cases weekly; override-patterns monthly.
- Firm admin: template governance (contracts × language, LORs, discovery sets, affidavits, EN/ES messages); rotation weights and language flags; carrier/provider/mediator directory stewardship; one-time PHI channel confirmations with referral facilities; fee-agreement litigation-authorization language.

### `lien_disbursement` — Lien & Disbursement Specialist (Emily, 0.5)

Turn a settled case into money correctly distributed. Finance detail is her tier and the attorney's, no one else's.

- Own the lien lifecycle: day-one inquiries (CMS query, health-insurance notices) → assertion → verification against the treatment record → negotiation of reductions → payoff letters. **Medicare conditional payments run on a federal clock — start early, never at settlement.**
- Balance-variance flags (>20%) and coverage-box gaps feed her worklist.
- On settlement: confirm release and funding; deposit to trust; prepare the disbursement statement — gross, attorney fee per the fee agreement, **every** case expense (records invoices, filing fees, server, transcripts, mediator, experts), lien payoffs at negotiated figures, net to client. Client review and signature; disburse to client, providers **at REMIT addresses (not business addresses)**, and lienholders; resolve PINSCO deductible/subrogation recoveries back to the client.
- Coordinate sequencing with Kate/CM where a UM/UIM claim follows the liability settlement. Close the file; the analytics snapshot finalizes from her numbers.

---

## 3. Data domain access (RLS intent)

| Domain | intake | case_manager | litigation_paralegal | demand_writer | lien_disbursement | attorney |
|---|---|---|---|---|---|---|
| Leads / intake | ✓ | — | — | — | — | ✓ |
| Matters (core) | limited | ✓ | ✓ | ✓ | ✓ | ✓ |
| Medical / treatment | **DENY** | ✓ | ✓ | ✓ | ✓ | ✓ |
| Insurance / property | **DENY** | ✓ | ✓ | ✓ | ✓ | ✓ |
| Litigation court / service | **DENY** | milestones | ✓ | read | read | ✓ |
| Discovery work product | **DENY** | **DENY** | ✓ | **DENY** | **DENY** | ✓ |
| Liens / resolution | **DENY** | limited | limited | limited | ✓ | ✓ |
| Finance detail | **DENY** | **DENY** | **DENY** | **DENY** | ✓ | ✓ |
| Conflict clear / Level approve | **DENY** | **DENY** | **DENY** | **DENY** | **DENY** | ✓ († flag) |

**Permanent DENYs — never relax without a written decision:** `intake` on everything past leads · finance detail for anyone outside `lien_disbursement` + `attorney` · discovery work product outside `litigation_paralegal` + `attorney`.

Roles not listed (`admin`, `senior_paralegal`, `records_clerk`) are covered in §8 and must not be granted broader access than resolved there.

---

## 4. Caseload scoping

| Role | Matter list default |
|---|---|
| `case_manager` | Assigned only (`staff_assignment` as CM) |
| `litigation_paralegal` | Assigned only (as lit PL) |
| `attorney` / `admin` | Firm-wide |
| `senior_paralegal` | Firm-wide nav, † decisions gated — see §8 |
| `intake` | Leads world, not CM caseload |
| `demand_writer` / `lien_disbursement` | Package- and settlement-driven, not a caseload |

---

## 5. Workspace switcher

| From | Can open | Depth |
|---|---|---|
| `litigation_paralegal` | Case Manager workspace | Full CM tools; **audit records the paralegal's own identity** |
| `case_manager` | Litigation workspace | Milestones only — tasks and deadlines stay locked |
| `attorney` / `admin` | Both | Full |
| `senior_paralegal` | Both | Full nav, † decisions gated |

Every write carries a mandatory actor. Borrowing a workspace never borrows an identity.

---

## 6. Escalation paths

| From | To | Trigger |
|---|---|---|
| `intake` | `attorney` | WD / minor structure, suspected Level 3, conflicts between callers on one crash |
| `case_manager` | `attorney` | Level 3 facts, TBI screen, treatment gap or noncompliance, LOP approval |
| `case_manager` | `demand_writer` | Demand-ready package (starts Kate's 14-day clock) |
| `demand_writer` | `attorney` | Level 3 demand approval before send; escalated counters |
| `demand_writer` | `case_manager` | Package blockers — flag back, do not draft around |
| `litigation_paralegal` | `attorney` | Filing concern, default go/no-go, retained-expert decision, motions received |
| `case_manager` ↔ `litigation_paralegal` | `attorney` | Dual-track disagreement (tie-breaker — see §8) |
| any | `lien_disbursement` | Settlement funded — money side hands off |

Escalations must be modeled as a queue/status transition with a **required actor and a reason**, not a free-text note.

---

## 7. Standing constraints

- Additive-only schema changes; soft delete only.
- Every write audited with a mandatory actor.
- RLS is the security layer — nav locks are a hint, never the gate.
- Data capture follows the workflow.
- Every displayed date carries day, month, and year.
- Document-backed tasks complete themselves.
- Status indicators are links.

---

## 8. Action required

Discrepancies between the current build and the JD source, plus decisions pending with Michael. **Do not treat any of these as settled; a placeholder in a permissions system becomes permanent by default.**

### 8.1 Build changes

| # | Item | Change |
|---|---|---|
| 1 | **Multi-role assignment** | **Shipped (v2.19):** `core.staff_role_grant` + `hasRole` / `roles[]` on session. Primary remains `staff.role_code`. Wire real Emily dual-grant when Michael confirms FTE split — still no second Auth accounts. |
| 2 | **Case access for `demand_writer` and `lien_disbursement`** | **Shipped (UI):** queue links → `/cases/[id]?mode=readonly` + mutate deny in `cases/actions`. Deepen finance edits for lien in Pass 4 UI later. |
| 3 | **`senior_paralegal` over-granted** | **Hardened:** † gated on flags; Approvals nav locked; seed `review.demo` flags off. |
| 4 | **`records_clerk`** | **Quarantined:** active rows deactivated in v2.19. Confirm remove vs revive with Michael. |
| 5 | **`admin`** | Documented: Brett only. Finance **writes** require attorney or `lien_disbursement` (`staffCanWriteFinance`). Do not seed admin demos. |
| 6 | **Slug reconciliation** | Done — `lien_disbursement` only. |
| 7 | **Per-user dashboards** | **Shipped (MVP):** CM + Lit “Needs attention” boards (not number tiles). |
| 8 | **Finance UI blocks settlement flow** | Banner on `/liens`; finance pages still not built. |

### 8.2 Pending Michael's decision

1. **Daniel's authority.** Which decisions may he make alone — Level approvals, conflict clearance, viability reviews, Level 3 demand approval, suit authorization, ATTORNEY-VERIFY? Vacation coverage depends on it. The JD calls this the biggest structural gap.
2. **Trust accounting owner.** IOLTA reconciliation, operating-account bookkeeping, vendor payment — outside every JD. Bar-compliance sensitive.
3. **UM/UIM pipeline owner.** Kate drafting with CM sequencing, or the paralegal when suit against the carrier is needed?
4. **Template maintenance executor.** Attorney owns governance; nobody physically edits and tests contracts, LORs, discovery sets, EN/ES messages.
5. **Unassigned Media pen backstop.** Intake is a rotating hat — name a default owner with a morning-check task.
6. **Main-line phone / dispatcher default** when the caller's case owner is out.
7. **Records-vendor account administration** — Datavant/Ciox, eFileTexas, RingCentral, SMS provider.
8. **Directory steward** — everyone contributes carrier/provider/mediator intelligence; nobody owns accuracy. Suggest a quarterly review task.
9. **Marketing & referral reporting** — referral-source data is collectible; nobody runs the reports or maintains the relationships.
10. **Friendly-suit logistics on minor settlements** — paralegal (litigation mechanics) or `lien_disbursement` (settlement side)? Minors' money is court-supervised.
11. **Photo-reminder stop condition** — the CM's judgment call; make it an explicit line so reminders don't run forever.
12. **Dual-track tie-breaker** — CM and paralegal are jointly responsible; suggest the attorney breaks ties via the existing concern mechanism.
13. **Kate's internal workflow** — still unspecified by Kate. `/demands` screens wait on her walkthrough.

---

## Related

- [PROJECT_SECTIONS_BY_ROLE.md](PROJECT_SECTIONS_BY_ROLE.md) — section × role map
- [PROJECT_PHASES.md](PROJECT_PHASES.md) — phase build status
- [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md) — security gates per phase
- [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md) — SQL/API checks; UI testing alone is not sufficient for intake, finance, and discovery
