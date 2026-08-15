# Case Manager beta — runbook (Stage 3)

**Status:** Decisions locked 2026-08-15 — **preview-only pilot, Mark (1 CM), demo data.** Do **not** merge to `main`.  
**Audience:** Brett (eng) · Michael (owner) · **Mark Garza** (pilot CM)  
**Preview:** https://tuttle-os-git-role-partition-tuttle-os.vercel.app  
**Related:** `docs/LIFECYCLE_BUILD_PLAN.md` (canonical sequencing) · `docs/FINDINGS_CHECKLIST.md` (P1 consolidation 2026-07-28) · `docs/BUILD_PRIORITY_REVIEW_TODOS.md` Stage 3 · `docs/ROLE_TEST_ACCOUNTS.md`

---

## 1. Decision locks (locked 2026-08-15)

| Decision | Locked answer | Owner | Status |
|---|---|---|---|
| **Pilot size** | **1 CM: Mark Garza.** Christina / Emily can be added or swapped later without a rebuild. | Michael | **Locked** |
| **Lit with CM or after?** | **Stagger** — CM beta first; lit stays Stage 5 | Michael | **Locked** |
| **Where do CMs work?** | **Preview only** — do not merge `role-partition` → `main` for this pilot | Michael | **Locked** |
| **Data** | **Preview + demo** (`cm.demo`) until a later Auth / live-matter decision | Michael | **Locked** |

Production stays untouched. Pilot lives on the preview URL. Merge is a **later** decision after this preview week, not part of week 1.

**Changing CMs later:** yes. This lock is “one person on preview,” not “Mark forever.” To swap or add: send §2 known gaps to the next CM, they use the same preview + `cm.demo` (or their own Auth when provisioned). No merge, no schema change.

---

## 2. Known gaps (give this to CMs)

**Use Tuttle OS CM beta for:** My caseload, Needs attention, work queues (New / LOR / Liability / PD / Records), provider calls, matter cards (checklist, coverage, PD, records, demand/negotiation logging, documents), dual-track **CLIENT STILL TREATING** banner on litigating files that are still in treatment.

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

**This pilot does not merge.** PR #1 stays open. Revisit merge only after the preview week if Michael says CMs may use prod.

**Before a future merge (not this week):**

- [x] Lit stagger confirmed (**yes, stagger**)  
- [x] Explicit **preview-only** pilot (week 1)  
- [x] Named 1 CM (**Mark Garza**)  
- [x] §2 known gaps sent to Mark  
- [ ] Michael Day-4 / later sign-off: “CMs may use prod”  
- [ ] Real CM Auth provisioned (not required for preview+demo week)  
- [ ] Apply pending SQL if needed: `sql/21_upgrade_v2.20_negotiation_directionality.sql`  
- [ ] Smoke §3 on **production** after a future deploy  

**Do not** merge solely to “get queues on prod.”

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
