-- Rollback v2.8 coverage_na
\set ON_ERROR_STOP on
BEGIN;
DROP TABLE IF EXISTS medical.coverage_na CASCADE;
COMMIT;
