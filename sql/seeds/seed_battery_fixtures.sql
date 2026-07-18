-- Minimal fictional fixtures so sql/tests/test_v2.5_battery.sql can run on an empty project.
-- Idempotent: safe to re-run. NO real client data.
\set ON_ERROR_STOP on

SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- Actor staff (fixed UUID used by migrations + battery)
INSERT INTO core.person (person_id, first_name, last_name)
VALUES ('00000000-0000-0000-0000-00000000c0d1', 'System', 'Actor')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.staff (
  staff_id, person_id, role_code, email,
  is_attorney, can_approve_level, can_clear_conflicts, active
) VALUES (
  '00000000-0000-0000-0000-00000000c0de',
  '00000000-0000-0000-0000-00000000c0d1',
  'attorney',
  'system.actor@tuttle.local',
  true, true, true, true
) ON CONFLICT (staff_id) DO NOTHING;

-- Court for litigation tests
INSERT INTO ref.court (court_id, name, court_type, county, state)
SELECT '00000000-0000-0000-0000-00000000c0c1',
       '225th Judicial District Court', 'district', 'Bexar', 'TX'
WHERE NOT EXISTS (SELECT 1 FROM ref.court LIMIT 1);

-- Client A (Delgado) — matter 1
INSERT INTO core.person (person_id, first_name, last_name, date_of_birth)
VALUES ('00000000-0000-0000-0000-00000000a001', 'Rosa', 'Delgado', DATE '1986-07-14')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.contact_point (person_id, kind, phone, is_primary)
SELECT '00000000-0000-0000-0000-00000000a001', 'phone', '2105550187', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a001' AND kind = 'phone');

INSERT INTO core.contact_point (person_id, kind, email, is_primary)
SELECT '00000000-0000-0000-0000-00000000a001', 'email', 'rosa.delgado@example.com', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a001' AND kind = 'email');

INSERT INTO core.incident_group (
  incident_group_id, date_of_loss, case_type_code,
  incident_city, incident_county, incident_state
) VALUES (
  '00000000-0000-0000-0000-00000000b001',
  DATE '2025-07-02', 'auto', 'San Antonio', 'Bexar', 'TX'
) ON CONFLICT (incident_group_id) DO NOTHING;

INSERT INTO core.client_matter (
  client_matter_id, incident_group_id, client_person_id,
  matter_number, client_role, current_stage_code, in_person_signing
) VALUES (
  '00000000-0000-0000-0000-00000000d001',
  '00000000-0000-0000-0000-00000000b001',
  '00000000-0000-0000-0000-00000000a001',
  'TEST-0001', 'driver', 'litigation', false
) ON CONFLICT (client_matter_id) DO NOTHING;

-- Client B (Okafor) — matter 2 (battery T6 needs a second matter)
INSERT INTO core.person (person_id, first_name, last_name, date_of_birth)
VALUES ('00000000-0000-0000-0000-00000000a002', 'Chinedu', 'Okafor', DATE '1990-03-18')
ON CONFLICT (person_id) DO NOTHING;

INSERT INTO core.contact_point (person_id, kind, phone, is_primary)
SELECT '00000000-0000-0000-0000-00000000a002', 'phone', '2105552299', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a002' AND kind = 'phone');

INSERT INTO core.contact_point (person_id, kind, email, is_primary)
SELECT '00000000-0000-0000-0000-00000000a002', 'email', 'chinedu.okafor@example.com', true
WHERE NOT EXISTS (
  SELECT 1 FROM core.contact_point
  WHERE person_id = '00000000-0000-0000-0000-00000000a002' AND kind = 'email');

INSERT INTO core.incident_group (
  incident_group_id, date_of_loss, case_type_code,
  incident_city, incident_county, incident_state
) VALUES (
  '00000000-0000-0000-0000-00000000b002',
  DATE '2026-03-18', 'auto', 'San Antonio', 'Bexar', 'TX'
) ON CONFLICT (incident_group_id) DO NOTHING;

INSERT INTO core.client_matter (
  client_matter_id, incident_group_id, client_person_id,
  matter_number, client_role, current_stage_code, in_person_signing
) VALUES (
  '00000000-0000-0000-0000-00000000d002',
  '00000000-0000-0000-0000-00000000b002',
  '00000000-0000-0000-0000-00000000a002',
  'TEST-0002', 'driver', 'litigation', false
) ON CONFLICT (client_matter_id) DO NOTHING;

SELECT 'seed_battery_fixtures OK' AS status,
       (SELECT count(*) FROM core.client_matter) AS matters,
       (SELECT count(*) FROM core.person) AS persons,
       (SELECT count(*) FROM ref.court) AS courts,
       (SELECT count(*) FROM core.staff) AS staff;
