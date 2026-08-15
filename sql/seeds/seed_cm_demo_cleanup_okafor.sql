-- Soft-delete junk uploads/notes on CM demo matters (Delgado TEST-0001, Okafor TEST-0002)
-- so a CM pilot does not see recipes, datasheets, or keyboard-mash notes.
-- Additive / reversible (deleted_at only). Idempotent.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- Gibberish general note (Okafor)
UPDATE workflow.note
SET deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE entity_id IN (
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000d002'
  )
  AND deleted_at IS NULL
  AND note_type = 'general'
  AND body ILIKE '%jflsdjfljsdfljsdflkjds%';

-- Placeholder / off-topic files
UPDATE workflow.document
SET deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE client_matter_id IN (
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000d002'
  )
  AND deleted_at IS NULL
  AND (
    title ILIKE '%YAGEO%'
    OR title ILIKE '%Cheesecake%'
    OR title ILIKE '%Galaxy Image%'
    OR title ILIKE 'TEST IMAGE'
    OR title ILIKE '%Screenshot 2026%'
    OR title ILIKE '%LKA08860%'
    OR title ILIKE '%Tetss%'
    OR coalesce(original_filename, '') ILIKE '%YAGEO%'
    OR coalesce(original_filename, '') ILIKE '%Cheesecake%'
    OR coalesce(original_filename, '') ILIKE 'Screenshot 2026%'
    OR coalesce(original_filename, '') ILIKE '%LKA08860%'
    OR coalesce(original_filename, '') ILIKE '%Tetss%'
    OR coalesce(original_filename, '') ILIKE 'LKA08801%'
  );

-- CM-beta test clutter on Delgado (Civik / Camery / F-150 / remove logs)
UPDATE workflow.note
SET deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE entity_id IN (
    '00000000-0000-0000-0000-00000000d001',
    '00000000-0000-0000-0000-00000000d002'
  )
  AND deleted_at IS NULL
  AND (
    body ILIKE '%Honda Civik%'
    OR body ILIKE '%Toyota Camery%'
    OR body ILIKE '%Ford F-150%'
    OR body ILIKE 'PD vehicle track removed%'
    OR body ILIKE 'Testing the notes portion%'
    OR body ILIKE 'B4 smoke:%'
  );

SELECT 'seed_cm_demo_cleanup_okafor OK' AS status,
       (SELECT count(*) FROM workflow.document
        WHERE client_matter_id IN (
          '00000000-0000-0000-0000-00000000d001',
          '00000000-0000-0000-0000-00000000d002'
        )
          AND deleted_at IS NULL) AS docs_remaining,
       (SELECT count(*) FROM workflow.note
        WHERE entity_id IN (
          '00000000-0000-0000-0000-00000000d001',
          '00000000-0000-0000-0000-00000000d002'
        )
          AND deleted_at IS NULL) AS notes_remaining;

COMMIT;
