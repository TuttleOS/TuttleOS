-- ================================================================================
-- TUTTLE OS — v2.3 (F1 ONLY): drop the orphan duplicate deadline column
--
-- Finding F1 (Field-Name Consistency Review 2026-07-13):
--   litigation.scheduling_order carried BOTH expert_challenge_deadline AND
--   challenge_expert_deadline — the same Daubert/Robinson deadline twice.
--   litigation.apply_scheduling_order() reads ONLY expert_challenge_deadline;
--   the other column is referenced by nothing (no view, function, or rule).
--   Verified empty at time of application.
--
-- KEEPS:  expert_challenge_deadline
-- DROPS:  challenge_expert_deadline
-- Rollback: rollback_v2.3_f1_fix.sql (re-adds the empty column).
-- ================================================================================

BEGIN;

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

-- safety: refuse to run if the orphan somehow contains data
DO $$
DECLARE n bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM litigation.scheduling_order WHERE challenge_expert_deadline IS NOT NULL' INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'challenge_expert_deadline holds % non-null value(s) — investigate before dropping', n;
  END IF;
END $$;

ALTER TABLE litigation.scheduling_order
  DROP COLUMN IF EXISTS challenge_expert_deadline;

COMMENT ON COLUMN litigation.scheduling_order.expert_challenge_deadline IS
  'Deadline to challenge expert testimony (Robinson/Daubert). v2.3: duplicate column challenge_expert_deadline dropped 2026-07-13 — this is the only challenge column; orders that stagger challenges per side use extra workflow.deadline rows.';

COMMIT;
