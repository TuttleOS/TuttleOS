# CasePeer → Tuttle OS migration (Phase 10)

**Owner-run only.** Real client CSVs never enter git, CI, or preview demos.

| Gate | Requirement |
|---|---|
| **10.1** | CSVs stay in firm Dropbox (`0 Tuttle OS/CasePeer exported reports`) |
| **10.2** | Owner-controlled path; audit actor `…c0de` (System Actor / CasePeer load) |
| **10.3** | Post-load: battery + flag review + SOL reconciliation spot-check |
| **10.4** | Dropbox remains a **frozen parallel archive** — no bidirectional edit sync |

Related: [COMPLIANCE_GATES.md](COMPLIANCE_GATES.md) Phase 10, [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md), `sql/migration/`.

---

## What this pipeline does

1. **Load** three CasePeer export CSVs into a throwaway `staging` schema (headers mirrored verbatim).
2. **Transform** via `migrate_v2.5.sql` into `core.*` / `workflow.*` (persons, matters, notes, stubs).
3. **Check** with `post_load_checks.sql` + `sql/tests/test_v2.5_battery.sql`.

Matters are keyed by `core.client_matter.casepeer_case_id`. Re-running deletes prior rows that have a CasePeer id, then reloads.

---

## Prerequisites

1. Schema `01`→`05` applied; battery green on a **non-production rehearsal** DB first if possible.
2. **Supabase BAA signed** before loading real PHI (Phase 0 gate).
3. Local tools: `psql`, Python 3, `DATABASE_URL` in kit-root `.env.local`.
4. Export files present under Dropbox (default names):
   - `ClientsReport-8.csv`
   - `OpenCasesReport-4.csv`
   - `NotesReport.csv`

---

## Run (owner machine)

```bash
cd "/path/to/tuttle-os-dev-kit"

export DATABASE_URL='postgresql://…'   # or rely on .env.local
export CASEPEER_CSV_DIR="$HOME/Dropbox/0 Tuttle OS/CasePeer exported reports"
# optional if the open-case link count is not 770:
# export CASEPEER_EXPECTED_CASES=770

./scripts/run_casepeer_migrate.sh --dry-run   # print steps
./scripts/run_casepeer_migrate.sh             # type MIGRATE to confirm
```

Checks only (after a prior load):

```bash
./scripts/run_casepeer_migrate.sh --checks-only
```

Manual steps (same as the script):

```bash
pip install -r sql/migration/requirements.txt
python3 sql/migration/load_staging.py
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v expected_cases=770 -f sql/migration/migrate_v2.5.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/migration/post_load_checks.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/tests/test_v2.5_battery.sql
```

The loader **refuses** a `CASEPEER_CSV_DIR` inside the git kit (gate 10.1).

---

## After load

1. Open **Owner → Migration** (`/owner/migration`) for counts and SOL `needs_review` volume.
2. Spot-check `staging.migration_flags` (SQL) for status/type review flags.
3. Review SOL Watch — migrated SOLs are `needs_review` / ATTORNEY-VERIFY stubs.
4. Link real staff Auth users (`sql/seeds/link_staff_auth.sql` pattern) if new staff rows were created for unmatched CasePeer note authors.
5. Leave CasePeer/Dropbox **read-only archive** — day-to-day work happens in Tuttle OS only.

---

## What this does *not* do

- No live CasePeer API sync.
- No document bytes (metadata/Dropbox paths only; Phase 8 for Storage).
- No inventing litigation/discovery rows from CasePeer beyond notes + matter stubs.
- Historical `migrate.sql` / `load_staging_v21.py` are pre-rename / old paths — use **`migrate_v2.5.sql`** + **`load_staging.py`**.

---

## Rollback posture

There is no automatic “undo migration” script. Re-run is idempotent for `casepeer_case_id` rows. Demo/seed matters **without** a CasePeer id are left alone. Prefer a rehearsal project before production.
