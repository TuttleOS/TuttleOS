#!/usr/bin/env bash
# Owner-controlled CasePeer → Tuttle OS load (Phase 10).
# CSVs remain in Dropbox — never copy them into this git kit.
#
# Usage:
#   export DATABASE_URL='postgresql://...'
#   export CASEPEER_CSV_DIR='/path/to/0 Tuttle OS/CasePeer exported reports'
#   ./scripts/run_casepeer_migrate.sh           # load + transform
#   ./scripts/run_casepeer_migrate.sh --dry-run # print steps only
#   ./scripts/run_casepeer_migrate.sh --checks-only
#
# Optional:
#   CASEPEER_EXPECTED_CASES=770   (default; must match open-case link count)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/sql/migration"
EXPECTED="${CASEPEER_EXPECTED_CASES:-770}"
DRY_RUN=0
CHECKS_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --checks-only) CHECKS_ONLY=1 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

load_env() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

load_env "$ROOT/.env"
load_env "$ROOT/.env.local"

if ! command -v psql >/dev/null 2>&1; then
  if [[ -x /Library/PostgreSQL/17/bin/psql ]]; then
    export PATH="/Library/PostgreSQL/17/bin:$PATH"
  else
    echo "ERROR: psql not found on PATH" >&2
    exit 1
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set (.env.local)." >&2
  exit 1
fi

echo "==> Phase 10 CasePeer migration"
echo "    DATABASE_URL host: $(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')"
echo "    CASEPEER_CSV_DIR: ${CASEPEER_CSV_DIR:-<unset>}"
echo "    expected_cases: $EXPECTED"
echo "    CSVs must stay OUT of git (Dropbox only)."
echo ""

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] would: pip install -r sql/migration/requirements.txt"
  echo "[dry-run] would: python3 sql/migration/load_staging.py"
  echo "[dry-run] would: psql -v expected_cases=$EXPECTED -f sql/migration/migrate_v2.5.sql"
  echo "[dry-run] would: psql -f sql/migration/post_load_checks.sql"
  echo "[dry-run] would: psql -f sql/tests/test_v2.5_battery.sql"
  exit 0
fi

if [[ "$CHECKS_ONLY" -eq 1 ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIG/post_load_checks.sql"
  exit 0
fi

if [[ -z "${CASEPEER_CSV_DIR:-}" ]]; then
  echo "ERROR: set CASEPEER_CSV_DIR to the Dropbox export folder." >&2
  exit 1
fi

echo "About to LOAD real CasePeer CSVs into staging and TRANSFORM into core.*"
echo "This deletes prior rows with casepeer_case_id set, then inserts the export."
read -r -p "Type MIGRATE to continue: " confirm
if [[ "$confirm" != "MIGRATE" ]]; then
  echo "Aborted."
  exit 1
fi

python3 -m pip install -q -r "$MIG/requirements.txt"
python3 "$MIG/load_staging.py"

echo ""
echo "==> Transform (migrate_v2.5.sql)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v expected_cases="$EXPECTED" -f "$MIG/migrate_v2.5.sql"

echo ""
echo "==> Post-load checks"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIG/post_load_checks.sql"

echo ""
echo "==> Behavior battery"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/sql/tests/test_v2.5_battery.sql"

echo ""
echo "DONE. Review /owner/migration in the app. Keep Dropbox as frozen archive (gate 10.4)."
