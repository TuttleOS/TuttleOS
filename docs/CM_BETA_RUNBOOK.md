# Case Manager beta — runbook (Stage 3)

**Status:** In progress — prep on `role-partition` · **not** live on production until merge + Michael sign-off  
**Audience:** Brett (eng) · Michael (owner) · Mark / Christina / Emily (CMs)  
**Preview:** https://tuttle-os-git-role-partition-tuttle-os.vercel.app  
**Related:** `docs/FINDINGS_CHECKLIST.md` (P1 consolidation 2026-07-28) · `docs/BUILD_PRIORITY_REVIEW_TODOS.md` Stage 3 · `docs/ROLE_TEST_ACCOUNTS.md`

---

## 1. Decision locks (do these first)

| Decision | Recommendation | Owner | Status |
|---|---|---|---|
| **Lit with CM or after?** | **Stagger** — CM beta first; lit stays Stage 5 | Michael / Brett | **Proposed** — confirm |
| **Where do CMs work?** | Merge `role-partition` → `main` (prod) after Michael Day-4, **or** keep pilot on preview URL for week 1 | Michael | Open |
| **Pilot size** | Start with **1–2 CMs** (not all three) for 2 weeks | Michael | Open |
| **Data** | Assigned live matters only after Auth linked; until then use preview + `cm.demo` | Eng | Open |

Until Michael signs the table above, keep treating preview as the CM surface — do not surprise production users.

---

## 2. Known gaps (give this to CMs)

**Use Tuttle OS CM beta for:** My caseload, Needs attention, work queues (New / LOR / Liability / PD / Records), provider calls, matter cards (checklist, coverage, PD, records, demand/negotiation logging, documents).

**Do not expect yet:**

| Area | What’s missing |
|---|---|
| Auto CM rotation / Spanish routing | Manual assign only (F-14) |
| Welcome call = Tier-2 checklist | Not built (F-18) |
| One-click dual records + billing + §18.001 packet | Manual requests (F-27–F-29) |
| Kate’s Demand Writer screens | `/demands` skeleton; CM still owns negotiation ledger on the matter |
| Liens / disbursement finance UI | Banner — finance blocked (F-21 partial) |
| File-suit memo / suit auth | Not in beta (F-39–F-40) |
| Full litigation tools for CMs | Lit switcher = **milestones only** |
| Level / SOL / TBI disposition | Still **attorney** (Michael) |

**Escalate to Michael immediately:** Level 3 facts, TBI screens, treatment noncompliance, LOP, ATTORNEY-VERIFY SOL.

Full Jul 19 P1 scoreboard: **0 P1 DONE** — beta is intentional with gaps. Detail: `docs/FINDINGS_CHECKLIST.md` § Stage 0.

---

## 3. CM day-one smoke (15 minutes)

Sign in → land on **`/cases`**.

1. **Needs attention** — story cards open the right matter.  
2. **All assigned** — only *your* matters.  
3. Sidebar queues — New / LOR / Liability / PD / Records counts feel right.  
4. Open a matter — edit PD (no duplicate same year/make/model); upload a photo tagged to that vehicle; see thumbnail.  
5. Log a negotiation **offer** — side locks to Defense.  
6. Financials stays 🔒.  
7. Lit switcher (if used) — milestones only; no Tasks/Deadlines depth.  
8. Version updates → **Project map** — skim handoffs.

Demo login for rehearsal: `cm.demo@tuttlelawfirm.com` (password in `ROLE_TEST_PASSWORD` / ask Brett).

---

## 4. Provision real CM logins (eng)

Demo accounts ≠ Mark / Christina / Emily. Real beta needs:

1. **`core.staff` row** per CM  
   - `role_code = 'case_manager'`  
   - correct `person` name / email  
   - `active`  
2. **Supabase Auth user** for their firm email  
3. Link **`core.staff.auth_user_id`** to that Auth UUID  
4. **`staff_assignment`** as `case_manager` on the matters they own (end prior CM slots if transferring)  
5. Optional: `core.staff_role_grant` if they also hold another role (e.g. Emily 0.5 liens — confirm with Michael before dual-grant)

There is **no** committed seed for Mark/Christina/Emily (fictional demos only). Provision in Supabase (Dashboard or SQL + Auth admin) using the same pattern as `scripts/provision_role_test_accounts.cjs` — do **not** put real passwords in git.

Checklist per person:

- [ ] Staff row exists and `role_code` is `case_manager`  
- [ ] Auth user can sign in  
- [ ] `auth_user_id` linked  
- [ ] At least one assigned matter appears on `/cases`  
- [ ] They received the known-gaps section (§2)  

---

## 5. Ship path (merge gate)

```
role-partition (preview)  →  PR → main  →  Vercel production
```

**Before merge:**

- [ ] Michael Day-4 / beta sign-off (written or chat: “CMs may use prod”)  
- [ ] Lit stagger confirmed (recommended: **yes, stagger**)  
- [ ] §2 known gaps sent to pilot CMs  
- [ ] At least one real CM provisioned **or** explicit “preview-only pilot for week 1”  
- [ ] Apply pending SQL if needed: `sql/21_upgrade_v2.20_negotiation_directionality.sql` (app validation works without it)  
- [ ] Smoke §3 on **production** after deploy with `cm.demo` or real CM  

**Do not** merge solely to “get queues on prod” without the sign-off row above.

Open PR when ready: `gh pr create` from `role-partition` → `main` (or ask Brett).

---

## 6. Feedback loop during beta

| Channel | Use for |
|---|---|
| Version updates thumbs / notes | Per-release UI feedback |
| Chat to Brett / Michael | Blockers, wrong caseload, RLS surprises |
| Findings IDs (F-xx) | Map requests back to Jul 19 backlog |

Out of scope for beta hotfixes: full Kate workspace, finance disbursement, migration, file-suit engine.

---

## 7. Exit criteria (beta → “CM is default”)

- Pilot CMs use `/cases` as daily home for ≥2 weeks  
- No P0 security / wrong-caseload incidents  
- Top 5 CM complaints logged against F-IDs or new tickets  
- Decision: widen to all CMs **or** pause for intake/contract P1 (F-01/F-04/F-05)

Then Stage 5 (lit) or intake P1 — per Michael.
