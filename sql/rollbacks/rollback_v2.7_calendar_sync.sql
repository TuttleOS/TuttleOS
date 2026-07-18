-- Rollback Phase 9 calendar sync (v2.7)
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

DROP TABLE IF EXISTS workflow.deadline_calendar_sync CASCADE;
DROP TABLE IF EXISTS workflow.calendar_connection CASCADE;

COMMIT;
