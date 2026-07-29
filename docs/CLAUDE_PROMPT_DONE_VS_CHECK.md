# Prompt for Claude — Build a “done vs check” checklist

**How to use:** Paste this entire file into Claude (or attach it). Optionally also attach:
- `docs/CM_BETA_RUNBOOK.md`
- `docs/FINDINGS_CHECKLIST.md` (§ Stage 0 P1 consolidation)
- `docs/BUILD_PRIORITY_REVIEW_TODOS.md`
- `docs/PROJECT_SECTIONS_BY_ROLE.md`

Ask Claude to output a **checklist Michael (or Brett) can walk in ~20–30 minutes** on the **role-partition preview**.

---

## Your job (Claude)

Produce a clear markdown checklist with two columns of work:

1. **DONE — already shipped** (on branch `role-partition` / preview; not necessarily production/`main`)
2. **TO CHECK — verify on preview** (concrete clicks, expected result, pass/fail)

Then add:
3. **NOT IN SCOPE / known gaps** (so nobody marks them as failed checks)
4. **Decisions still needed from Michael** before Stage 3 merge to production

Tone: plain English, attorney/owner-friendly. Use checkboxes `- [ ]`. Group by area. Prefer “open X → expect Y” over jargon.

**Preview URL:** https://tuttle-os-git-role-partition-tuttle-os.vercel.app  
**PR (merge gated):** https://github.com/TuttleOS/TuttleOS/pull/1  
**Branch:** `role-partition`  
**Date context:** work through ~2026-07-28

---

## Context — what was built (source of truth for “DONE”)

### A. Foundation / roles
- Demo logins per role (`cm.demo`, `lit.demo`, `intake.demo`, `demand.demo`, `liens.demo`, `review.demo`) — `docs/ROLE_TEST_ACCOUNTS.md`
- Attorney/admin **Role roster preview** (header): preview any workspace; audit stays signed-in attorney
- Role partition Passes 1–4: † gates, multi-role grants, demand/lien matter `?mode=readonly`, CM/Lit Needs attention, liens finance banner
- Stage 0 **P1 consolidation** of Jul 19 findings: walked; **0 P1 fully DONE**; F-21 → PARTIAL; documented in `FINDINGS_CHECKLIST.md`

### B. Case Manager / Lit dashboards
- Per-user CM caseload + **Needs attention** story cards (attorney-style)
- Work queues: New cases / LORs / Liability / PD / Records (live counts, deep-links)
- Lit Needs attention (JX due / no cause / PL unassigned)
- Same story-card pattern stubbed on Intake / Demand / Liens homes
- **Preview UX fix:** clicking “Case Manager” in roster auto-scopes to first CM person (Camila); empty New cases explains Camila vs untouched sign-up

### C. Matter deepen — Property damage
- Edit / soft-delete (Remove) vehicles
- Duplicate year+make+model blocked on create/edit
- Photo upload: drag-drop; tag to a vehicle; thumbnails + lightbox
- Per-vehicle upload + gallery filter

### D. Matter deepen — other
- Coverage boxes label **“No treatment”** (not vague N/A)
- Negotiation directionality: offers/counters = defense; counter-demand = plaintiff; client authority = client (UI lock + server validation; SQL CHECK file exists, apply on Supabase when ready)
- **Records & bills:** uploaded medical_records / medical_bills show thumbnails + lightbox (same pattern as PD)
- Document upload drag-and-drop on section uploaders

### E. Version updates / docs
- `/updates`: **Project map** at top (workspaces, handoffs, build stages) + release notes
- `docs/CM_BETA_RUNBOOK.md` — Stage 3 known gaps, provision real CMs, merge gate, lit stagger proposal (**CM first, lit later**)

### F. Explicitly NOT done (do not put in “TO CHECK” as expected features)
- Auto CM rotation / language routing (F-14)
- Full Kate Demand Writer screens (`/demands` skeleton)
- Liens finance / disbursement UI (banner only)
- File-suit memo / suit authorization (F-39/F-40)
- One-click dual records+billing+§18.001 packet (F-27–F-29)
- Merging to **production** without Michael sign-off
- Full Jul 19 P1 backlog cleared

---

## Output format (Claude must follow)

```markdown
# Tuttle OS — Preview check sheet
Date: …
Preview: …
Tester: …

## 0. Setup
- [ ] …

## 1. DONE (shipped on role-partition) — for awareness
### Roles & preview
- …
### CM / Lit dashboards
- …
### Matter (PD / records / negotiation)
- …
### Docs / Stage 3
- …

## 2. TO CHECK on preview (walk these)
### A. Version updates
- [ ] Open /updates → expect Project map at top → Pass / Fail / Notes
### B. Role preview
- [ ] …
### C. CM as Camila Manager
- [ ] …
### D. Matter — PD
- [ ] …
### E. Matter — Records & bills
- [ ] …
### F. Matter — Negotiation
- [ ] …
### G. Demand / Liens (skeleton + read-only)
- [ ] …

## 3. Known gaps (do not fail the beta for these)
- …

## 4. Ask Michael before merge to production
- [ ] Lit stagger (CM first)?
- [ ] Pilot size (1–2 CMs)?
- [ ] OK to merge PR #1?
- [ ] …

## 5. Result
- Overall: Ready for CM beta sign-off? Yes / No / With conditions
- Conditions / bugs found:
```

For every **TO CHECK** item include: **steps**, **expected**, and a **Pass/Fail** checkbox or blank Notes line.

Prefer ~25–40 check items total — thorough but skimmable. Map critical items to finding IDs (F-xx) or runbook sections only when helpful.

---

## Extra instructions for Claude

- If something in “DONE” contradicts an attached doc, **trust the attached docs** and note the conflict.
- Distinguish **preview** vs **production** clearly in every section that involves deploy.
- When checking CM caseload: instruct tester to select **Camila Manager** (or rely on auto-scope after latest push); explain New cases may be empty if sign-up already started — My Caseload is the full list.
- Demo password: do **not** invent or print passwords; say “ask Brett / ROLE_TEST_PASSWORD in .env.local”.
- End with a one-paragraph “bottom line for Michael.”
