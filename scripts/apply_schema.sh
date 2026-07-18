#!/usr/bin/env bash
# Apply Tuttle OS schema v2.0 → v2.5 in order, then run the behavior battery.
# Usage:
#   export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DBNAME'
#   ./scripts/apply_schema.sh
#
# Or with .env.local (preferred) or .env in the kit root containing DATABASE_URL=...
#
# Recommended: a Supabase project (Dashboard → Project Settings → Database → URI).
# For local Postgres you must have extensions: pgcrypto, citext, btree_gist, pg_trgm, vector (pgvector).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/sql"

load_env() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    echo "==> Loaded env from $(basename "$file")"
  fi
}

# .env.local wins over .env
load_env "$ROOT/.env"
load_env "$ROOT/.env.local"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Create $ROOT/.env.local with DATABASE_URL=postgresql://... (copy from .env.example)."
  echo "See docs/DATABASE_SETUP.md"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  if [[ -x /Library/PostgreSQL/17/bin/psql ]]; then
    export PATH="/Library/PostgreSQL/17/bin:$PATH"
  else
    echo "ERROR: psql not found on PATH"
    exit 1
  fi
fi

echo "==> Preflight: extensions"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pgcrypto','citext','btree_gist','pg_trgm','vector')
ORDER BY 1;
SQL

apply() {
  local file="$1"
  echo ""
  echo "==> Applying $(basename "$file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
}

apply "$SQL/01_schema_v2.0.sql"
apply "$SQL/02_upgrade_v2.1.sql"
apply "$SQL/03_upgrade_v2.3_f1_fix.sql"
apply "$SQL/04_upgrade_v2.4_18001_engine.sql"
apply "$SQL/05_upgrade_v2.5_naming.sql"

echo ""
echo "==> Schema object counts"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT nspname AS schema, count(*) AS tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND nspname IN ('core','intake','medical','insurance','litigation','property',
                  'resolution','liens','finance','workflow','ref','analytics','audit','app')
GROUP BY 1 ORDER BY 1;
SQL

echo ""
echo "==> Seeding fictional battery fixtures (sql/seeds/seed_battery_fixtures.sql)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL/seeds/seed_battery_fixtures.sql"

echo ""
echo "==> Running sql/tests/test_v2.5_battery.sql"
# Battery uses psql meta-commands (\gset); needs a real psql session.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL/tests/test_v2.5_battery.sql"

echo ""
echo "DONE. Schema 01→05 applied. Review battery PASS lines above."
echo "Next (Supabase): expose schemas in API settings; GRANT app_staff TO authenticated;"
echo "See docs/DATABASE_SETUP.md and docs/COMPLIANCE_GATES.md Phase 0."
