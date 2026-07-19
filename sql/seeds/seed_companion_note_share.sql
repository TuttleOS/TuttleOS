-- Demo companions for B4 note-sharing smoke.
-- Adds a same-crash companion on TEST-0001's incident group + clears copy sharing.
\set ON_ERROR_STOP on
BEGIN;

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

INSERT INTO core.person (
  person_id, first_name, last_name, preferred_language
) VALUES (
  '00000000-0000-0000-0000-00000000a101',
  'Alex', 'Reyes', 'en'
) ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.client_matter (
  client_matter_id,
  incident_group_id,
  client_person_id,
  matter_number,
  client_role,
  current_stage_code,
  in_person_signing
) VALUES (
  '00000000-0000-0000-0000-00000000d101',
  '00000000-0000-0000-0000-00000000b001',
  '00000000-0000-0000-0000-00000000a101',
  'TEST-0001B',
  'passenger',
  'treating',
  false
) ON CONFLICT (client_matter_id) DO NOTHING;

INSERT INTO core.representation_link (
  representation_link_id,
  matter_a,
  matter_b,
  relationship,
  joint_representation,
  conflict_status,
  cleared_by,
  cleared_date,
  copy_sharing_allowed
) VALUES (
  '00000000-0000-0000-0000-00000000e101',
  LEAST(
    '00000000-0000-0000-0000-00000000d001'::uuid,
    '00000000-0000-0000-0000-00000000d101'::uuid
  ),
  GREATEST(
    '00000000-0000-0000-0000-00000000d001'::uuid,
    '00000000-0000-0000-0000-00000000d101'::uuid
  ),
  'same_crash_companion',
  true,
  'cleared',
  '00000000-0000-0000-0000-00000000c0de',
  CURRENT_DATE,
  true
)
ON CONFLICT (matter_a, matter_b) DO UPDATE
SET
  conflict_status = EXCLUDED.conflict_status,
  copy_sharing_allowed = EXCLUDED.copy_sharing_allowed,
  cleared_by = EXCLUDED.cleared_by,
  cleared_date = EXCLUDED.cleared_date,
  deleted_at = NULL;

COMMIT;
