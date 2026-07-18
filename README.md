# Tuttle OS — Development Kit

Everything needed to build the Tuttle Law Firm practice-management system: the complete, tested PostgreSQL/Supabase schema, the clickable mockups that serve as the functional spec, the owner's design-decision rulebook, and a master prompt that tells Cursor AI exactly how to build the app.

## How to use this with Cursor

1. Unzip this folder and open it in Cursor (`File → Open Folder`).
2. Cursor reads `.cursorrules` automatically. For the first session, also say:
   > Read MASTER_PROMPT.md in full, then docs/ui-design-decisions.md, then start Phase 1.
3. Work phase by phase (MASTER_PROMPT.md §7). Each phase ends with passing Playwright tests before the next begins.
4. Keep `DECISIONS_NEEDED.md` (Cursor will create it) on your review list — that's where anything requiring Michael's call accumulates.

## What's in here

```
MASTER_PROMPT.md          ← the build specification (read first)
.cursorrules              ← distilled rules Cursor applies to every edit
README.md                 ← this file

sql/                      ← APPLIED schema, in order (01 → 05)
  01_schema_v2.0.sql            full base schema (12 schemas, 96 tables)
  02_upgrade_v2.1.sql           security/audit/SOL/RLS/automation hardening
  03_upgrade_v2.3_f1_fix.sql    duplicate-column fix
  04_upgrade_v2.4_18001_engine.sql   § 18.001 per-defendant clocks + DCO supersession
  05_upgrade_v2.5_naming.sql    naming-standard sweep (56 renames)
  optional/                     drafted, NOT yet adopted (Phase 8)
    06_upgrade_v2.2_documents.sql     file storage layer
    07_upgrade_v2.6_documents_ai.sql  AI enrichment + full-text search
  rollbacks/                    tested reversal scripts for v2.2–v2.6
  tests/
    test_v2.5_battery.sql       14 behavior tests — must pass after setup
    test_v2.4_18001.sql         historical (pre-rename names)
  migration/
    migrate_v2.5.sql            CasePeer staging → schema transform (current)
    load_staging.py             CSV → staging (Dropbox path via CASEPEER_CSV_DIR)
    post_load_checks.sql        gate 10.3 spot checks
    migrate.sql / load_staging_v21.py   historical
    NOTE: CSVs are NOT in this kit — see docs/CASEPEER_MIGRATION.md
  scripts/run_casepeer_migrate.sh       owner-run Phase 10 orchestration

docs/
  ui-design-decisions.md        THE RULEBOOK — every owner decision, numbered
  schema-overview-for-designer.md  one-page schema orientation
  DESIGN_NOTES.md               firm design notes + the Naming Standard
  field-name-consistency-review.md  naming audit history/rationale
  documents-feature-review.md   documents/AI feature plan (Phase 8)
  SECURITY_PROTOCOLS.md         HIPAA-ready security rulebook (MFA, RLS, BAAs)
  COMPLIANCE_GATES.md           phase-by-phase security/compliance launch gates
  SECURITY_TEST_PLAN.md         RLS / auth / audit / document access regression matrix
  ENV_AND_DEPLOY.md             secrets, headers, PHI-safe logging, env separation
  SECURITY_ADDONS_BACKLOG.md    prioritized P0–P3 security add-ons + tickets

.env.example                    PHI-safe env var names (no secrets) — copy to .env.local

mockups/                  ← the functional spec — open in any browser, everything clicks
  intake-workspace-mockup.html
  case-manager-workspace-mockup.html
  litigation-paralegal-workspace-mockup.html
  owner-dashboard-mockup.html
  document-upload-mockup.html   (Phase 8 preview)
  theme-preview-mockup.html     (4 theme directions; tokens)
```

## Database quick-start (before any frontend work)

See **`docs/DATABASE_SETUP.md`**. Short version:

1. Create a Supabase project (Postgres 15+; extensions: pgcrypto, citext, btree_gist, pg_trgm, vector).
2. Put the DB URI in `.env.local` as `DATABASE_URL` (copy from `.env.example`).
3. Run `./scripts/apply_schema.sh` — applies `sql/01` → `05` and the v2.5 battery.
4. Expose the schemas in API settings; `GRANT app_staff TO authenticated;`.
5. Create staff auth users and set `core.staff.auth_user_id`.
6. Sign the Supabase BAA before any real PHI.

## Security & compliance (read before production PHI)

1. `docs/SECURITY_PROTOCOLS.md` — standing security rulebook (Supabase MFA, RLS, BAAs, documents/AI gates).
2. `docs/COMPLIANCE_GATES.md` — phase exit criteria; Phase 0 requires Supabase BAA before real PHI.
3. `docs/SECURITY_TEST_PLAN.md` — role/RLS/actor/soft-delete/document access matrix.
4. `.env.example` + `docs/ENV_AND_DEPLOY.md` — secrets, headers, preview protection, PHI-safe logs.
5. `docs/SECURITY_ADDONS_BACKLOG.md` — password manager, backups, Sentry scrubbing, SSO, pen test, etc.

## Web app (Phase 1+)

```
web/                      ← Next.js App Router app
  src/app/(app)/          role workspaces + search
  src/app/login/          staff sign-in
  src/components/shell/   top bar, global search, nav
  README.md               run instructions
```

```bash
cd web && npm install && npm run dev
```

## Ground truths (the short version)

The database enforces security and computes the law — the app displays and captures. Column names are the API. No hard deletes. Every date shows its year. Every status is clickable. The mockups show how it should behave; the rulebook says why. When in doubt, docs/ui-design-decisions.md wins.

— Prepared July 14, 2026, from the working build (770 migrated test cases, all batteries green).
