# Role test accounts — smoke matrix

**Purpose:** One login per workspace role so Michael / eng can verify partitioning (nav + RLS) without sharing Michael’s attorney account.

**Admin / attorney role preview:** Click your name/role in the header → roster of roles and who holds them → preview that workspace. Writes/audit stay yours. Demo Auth logins remain for true RLS smoke.

**Status:** Fictional demo staff only — not real employees.  
**Passwords:** Never committed. Shared demo password lives in `ROLE_TEST_PASSWORD` in `web/.env.local` (gitignored). Ask Brett.

**Existing owner/dev accounts (unchanged):**

| Email | Role | Home |
|---|---|---|
| `michael@tuttlelawfirm.com` | attorney | `/owner` |
| `brett.earl@gmail.com` | admin | `/owner` |

---

## Role demo logins

| Email | Display name | `role_code` | Home after login | What to verify |
|---|---|---|---|---|
| `cm.demo@tuttlelawfirm.com` | Camila Manager | `case_manager` | `/cases` | Caseload + work queues; Financials 🔒; can open Lit **milestones only** |
| `lit.demo@tuttlelawfirm.com` | Leo Paralegal | `litigation_paralegal` | `/litigation` | Full lit tools; switcher → **full** CM view |
| `intake.demo@tuttlelawfirm.com` | Ava Intake | `intake` | `/intake` | Lead queue only; Cases/Lit 🔒; DB blocks medical/litigation |
| `review.demo@tuttlelawfirm.com` | Daniel Review | `senior_paralegal` | `/owner` | Approvals 🔒 without † flags; smoke Level/conflict deny |
| `demand.demo@tuttlelawfirm.com` | Kate Demand | `demand_writer` | `/demands` | Queue → matter `?mode=readonly`; writes denied |
| `liens.demo@tuttlelawfirm.com` | Emily Liens | `lien_disbursement` | `/liens` | Finance banner + readonly matter links |

Battery matters `d001` / `d002` are assigned to **Camila (CM)** and **Leo (Lit PL)** after seed (Michael’s CM/PL slots on those matters are ended so role smoke tests are realistic). Michael still signs in as attorney/owner.

---

## Provision (eng)

```bash
# 0) Multi-role grants + quarantine (once)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/20_upgrade_v2.19_staff_role_grant.sql

# 1) Staff rows + assignments + primary grants
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/seeds/seed_role_test_staff.sql

# 2) In web/.env.local add (do not commit):
# ROLE_TEST_PASSWORD='your-shared-demo-password-here'

# 3) Create Auth users + link auth_user_id
node scripts/provision_role_test_accounts.cjs
```

Requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`.

---

## Quick smoke checklist

1. Sign out → sign in as each email above.  
2. Confirm **home route** matches the table.  
3. Intake: try opening `/cases` or medical data — expect lock / empty / RLS error, not full PHI.  
4. CM: caseload non-empty (assigned matters); Lit switcher is milestones-only.  
5. Lit: full deadlines/tasks; switcher opens full CM.  
6. Demand / Liens: land on skeleton pages without crashing.

---

## Related

- Phases: `docs/PROJECT_PHASES.md` (1–6 done; 7 skeletons)  
- Security tiers: `docs/SECURITY_PROTOCOLS.md`  
- Seed: `sql/seeds/seed_role_test_staff.sql`  
- Script: `scripts/provision_role_test_accounts.cjs`
