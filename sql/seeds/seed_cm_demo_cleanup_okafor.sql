-- Soft-delete junk uploads/notes on the Okafor demo matter (TEST-0002)
-- so a CM pilot does not see cheesecake "medical records" or keyboard-mash notes.
-- Additive / reversible (deleted_at only). Idempotent.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- Gibberish general note
UPDATE workflow.note
SET deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE entity_id = '00000000-0000-0000-0000-00000000d002'
  AND deleted_at IS NULL
  AND note_type = 'general'
  AND body ILIKE '%jflsdjfljsdfljsdflkjds%';

-- Placeholder / off-topic files (recipes, datasheets, stock images)
UPDATE workflow.document
SET deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002'
  AND deleted_at IS NULL
  AND (
    title ILIKE '%YAGEO%'
    OR title ILIKE '%Cheesecake%'
    OR title ILIKE '%Galaxy Image%'
    OR title ILIKE 'TEST IMAGE'
    OR coalesce(original_filename, '') ILIKE '%YAGEO%'
    OR coalesce(original_filename, '') ILIKE '%Cheesecake%'
  );

SELECT 'seed_cm_demo_cleanup_okafor OK' AS status,
       (SELECT count(*) FROM workflow.document
        WHERE client_matter_id = '00000000-0000-0000-0000-00000000d002'
          AND deleted_at IS NULL) AS docs_remaining,
       (SELECT count(*) FROM workflow.note
        WHERE entity_id = '00000000-0000-0000-0000-00000000d002'
          AND deleted_at IS NULL) AS notes_remaining;

COMMIT;
