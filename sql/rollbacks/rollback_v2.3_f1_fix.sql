-- ================================================================================
-- TUTTLE OS — v2.3 (F1) ROLLBACK: restore the dropped column (empty, as it was)
-- ================================================================================
BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);
ALTER TABLE litigation.scheduling_order
  ADD COLUMN IF NOT EXISTS challenge_expert_deadline date;
COMMENT ON COLUMN litigation.scheduling_order.expert_challenge_deadline IS NULL;
COMMIT;
