# Tuttle OS — Database Setup (Phase 0)

Apply the shipped schema **in order**: `sql/01` → `05`, then run `sql/tests/test_v2.5_battery.sql`.  
Do **not** apply `sql/optional/` (documents/AI) until Phase 8 + owner BAAs.

Related: [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md), [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md), `scripts/apply_schema.sh`.

---

## Recommended: Supabase cloud (matches production stack)

Auth, RLS, Storage, and extensions (`vector`, etc.) are already available.

### 1. Create project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. New project → region close to San Antonio / US (e.g. `us-east-1` or `us-west-2`)
3. Save the database password in the firm password manager
4. **Sign the Supabase BAA before loading real PHI** (see security docs)

### 2. Connection string
Dashboard → **Project Settings → Database**:
- Use the **URI** connection string (direct or Session pooler for applying SQL from a laptop)
- Format: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres`  
  or direct: `postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres`

### 3. Apply schema from this kit

```bash
cd "tuttle-os-dev-kit (1)"
cp .env.example .env.local   # preferred (gitignored)
# Edit .env.local — set DATABASE_URL to your Supabase URI (URL-encode special chars in the password)

chmod +x scripts/apply_schema.sh
./scripts/apply_schema.sh
```

Expect: extensions OK → five migrations → table counts → battery `PASS` lines.

### 4. Post-apply (Supabase API)
1. Dashboard → **Settings → API → Exposed schemas**  
   Add: `core, intake, medical, insurance, litigation, property, resolution, liens, finance, workflow, ref, analytics`  
   (and `audit` only if you intentionally expose it — prefer server-only access)
2. In SQL editor:

```sql
GRANT app_staff TO authenticated;
```

3. Create staff Auth users; set `core.staff.auth_user_id` to each Auth UUID  
4. Enforce MFA before production PHI

### 5. Types (later, Phase 1 app)
```bash
npx supabase gen types typescript --project-id YOUR_REF > src/types/database.ts
```

---

## Alternative: local Postgres 17 (scratch only)

This machine has `/Library/PostgreSQL/17` listening on port 5432.  
**Blockers we hit:**
- `psql` requires a password (no `.pgpass` yet)
- **`vector` (pgvector) is not installed** into that Postgres — required by `01_schema_v2.0.sql`

If you stay local:
1. Install pgvector **built against** PostgreSQL 17 (EDB), or use Homebrew PostgreSQL + matching `pgvector` formula
2. Put credentials in `.env`:

```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/tuttle_os
```

3. Create empty DB, then run `./scripts/apply_schema.sh`

Local has **no** Supabase Auth/RLS JWT bridge until you add Supabase local (needs Docker) or point the app at cloud Auth later. Prefer cloud Supabase for Phase 0–1.

---

## What gets applied

| File | Purpose |
|---|---|
| `01_schema_v2.0.sql` | Full base (12 schemas, tables, engines, seeds) |
| `02_upgrade_v2.1.sql` | Soft delete, audit actor, RLS tiers, SOL, automation |
| `03_upgrade_v2.3_f1_fix.sql` | Duplicate column fix |
| `04_upgrade_v2.4_18001_engine.sql` | § 18.001 per-defendant clocks |
| `05_upgrade_v2.5_naming.sql` | Naming-standard renames |
| `tests/test_v2.5_battery.sql` | 14 behavior asserts — must PASS |

**Skip for now:** `optional/06`, `optional/07`.  
**CasePeer load (Phase 10):** owner-run only — see [`CASEPEER_MIGRATION.md`](CASEPEER_MIGRATION.md). Never put export CSVs in this kit.

---

## Verify by hand

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema IN ('core','workflow','litigation','medical','insurance');

-- After battery, confirm no FAIL lines in psql output
```

---

## Owner checklist (Phase 0 gate)

- [ ] Supabase project created (or local scratch accepted)
- [ ] `01`→`05` applied
- [ ] Battery all PASS
- [ ] Schemas exposed + `GRANT app_staff TO authenticated`
- [ ] BAA signed before real client data
- [ ] Staging ≠ production project
