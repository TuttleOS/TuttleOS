-- ============================================================
-- CasePeer migration — post-load spot checks (gate 10.3)
-- Run after migrate_v2.5.sql. Does not modify data.
-- ============================================================
\set ON_ERROR_STOP on

\echo '==> Matters with casepeer_case_id'
SELECT count(*) AS casepeer_matters,
       count(*) FILTER (WHERE sol_status = 'needs_review') AS sol_needs_review,
       count(*) FILTER (WHERE current_stage_code = 'litigation') AS in_litigation
FROM core.client_matter
WHERE casepeer_case_id IS NOT NULL
  AND deleted_at IS NULL;

\echo '==> Staging migration flags (top 15 by frequency)'
SELECT flag, count(*) AS n
FROM staging.migration_flags
GROUP BY 1
ORDER BY n DESC
LIMIT 15;

\echo '==> SOL reconciliation sample (first 20 mismatches / needs attention)'
SELECT client_matter_id, client, stored_sol, computed_sol, reconciliation
FROM core.v_sol_reconciliation
WHERE reconciliation IS DISTINCT FROM 'match'
LIMIT 20;

\echo '==> Migration actor present'
SELECT staff_id, active, role_code
FROM core.staff
WHERE staff_id = '00000000-0000-0000-0000-00000000c0de';

\echo 'DONE. Review flags + SOL; keep Dropbox as frozen archive (gate 10.4).'
