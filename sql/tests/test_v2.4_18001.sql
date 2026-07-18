-- v2.4 § 18.001 engine — behavior test battery (Michael's multi-defendant scenario)
\set ON_ERROR_STOP on
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', false);

-- ---------- setup: one matter, one court case, three defendants ----------
SELECT client_matter_id AS cm FROM core.client_matter LIMIT 1 \gset
SELECT person_id AS p1 FROM core.person LIMIT 1 \gset

INSERT INTO litigation.court_case (court_case_id, client_matter_id, cause_number, court_id)
VALUES (gen_random_uuid(), :'cm', 'TEST-2026-CI-18001', (SELECT court_id FROM ref.court LIMIT 1))
RETURNING court_case_id AS cc \gset

INSERT INTO litigation.lit_party (lit_party_id, court_case_id, person_id, pleaded_name, alignment)
VALUES (gen_random_uuid(), :'cc', :'p1', 'TEST Defendant One LLC', 'defendant')
RETURNING lit_party_id AS d1 \gset
INSERT INTO litigation.lit_party (lit_party_id, court_case_id, person_id, pleaded_name, alignment)
VALUES (gen_random_uuid(), :'cc', :'p1', 'TEST Defendant Two', 'defendant')
RETURNING lit_party_id AS d2 \gset
INSERT INTO litigation.lit_party (lit_party_id, court_case_id, person_id, pleaded_name, alignment)
VALUES (gen_random_uuid(), :'cc', :'p1', 'TEST Defendant Three Inc', 'defendant')
RETURNING lit_party_id AS d3 \gset
-- and one PLAINTIFF-side party (must NOT get clocks)
INSERT INTO litigation.lit_party (lit_party_id, court_case_id, person_id, pleaded_name, alignment)
VALUES (gen_random_uuid(), :'cc', :'p1', 'TEST Plaintiff', 'plaintiff');

-- ---------- T1: three defendants answer on three different dates ----------
UPDATE litigation.lit_party SET answer_filed = DATE '2026-01-05' WHERE lit_party_id = :'d1';
UPDATE litigation.lit_party SET answer_filed = DATE '2026-03-01' WHERE lit_party_id = :'d2';
UPDATE litigation.lit_party SET answer_filed = DATE '2026-06-10' WHERE lit_party_id = :'d3';
UPDATE litigation.lit_party SET answer_filed = DATE '2026-02-01' WHERE alignment='plaintiff' AND court_case_id = :'cc';

SELECT CASE WHEN count(*) = 3 THEN 'T1a PASS — 3 independent serve clocks' ELSE 'T1a FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_serve_90' AND status='pending';
SELECT CASE WHEN count(*) = 3 THEN 'T1b PASS — 3 counter watches' ELSE 'T1b FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_counter_120' AND status='pending';
SELECT CASE WHEN bool_and(ok) THEN 'T1c PASS — dates = answer+90 (Apr 5, May 30, Sep 8)' ELSE 'T1c FAIL' END FROM (
  SELECT effective_date IN (DATE '2026-04-05', DATE '2026-05-30', DATE '2026-09-08') AS ok
  FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_serve_90' AND status='pending') x;
SELECT CASE WHEN count(*) = 0 THEN 'T1d PASS — plaintiff-side party got NO clocks' ELSE 'T1d FAIL' END
FROM workflow.deadline d JOIN litigation.lit_party lp ON lp.lit_party_id = d.entity_id
WHERE lp.alignment='plaintiff' AND d.rule_code LIKE 'affidavit_18001%';

-- ---------- T2: idempotency — re-saving the same answer date adds nothing ----------
UPDATE litigation.lit_party SET answer_filed = DATE '2026-01-05' WHERE lit_party_id = :'d1';
UPDATE litigation.lit_party SET notes = 'touched' WHERE lit_party_id = :'d1';
SELECT CASE WHEN count(*) = 6 THEN 'T2 PASS — still exactly 6 rows (no double-fire)' ELSE 'T2 FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code LIKE 'affidavit_18001%' AND status='pending';

-- ---------- T3: DCO sets ONE 18.001 date → all serve clocks fall, counters stand ----------
INSERT INTO litigation.scheduling_order (scheduling_order_id, court_case_id, order_type, signed_date,
  affidavit_18001_deadline, discovery_close, expert_designation_plaintiff)
VALUES (gen_random_uuid(), :'cc', 'dco', DATE '2026-07-01', DATE '2026-10-01', DATE '2026-12-18', DATE '2026-09-15')
RETURNING scheduling_order_id AS so1 \gset
SELECT litigation.apply_scheduling_order(:'so1') AS created \gset
SELECT CASE WHEN count(*) = 0 THEN 'T3a PASS — every per-answer serve clock VACATED' ELSE 'T3a FAIL: '||count(*)||' still pending' END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_serve_90' AND source='rule' AND status='pending';
SELECT CASE WHEN count(*) = 1 AND min(effective_date) = DATE '2026-10-01' THEN 'T3b PASS — ONE court-ordered 18.001 date (Oct 1, 2026) docketed' ELSE 'T3b FAIL' END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_serve_90' AND source='court_order' AND status='pending';
SELECT CASE WHEN count(*) = 3 THEN 'T3c PASS — counter watches UNTOUCHED (order silent on counters)' ELSE 'T3c FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_counter_120' AND source='rule' AND status='pending';
SELECT CASE WHEN bool_and(adjusted_reason LIKE '%court-ordered 18.001 date 2026-10-01%') THEN 'T3d PASS — vacatur reason recorded on each' ELSE 'T3d FAIL' END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_serve_90' AND source='rule' AND status='vacated';

-- ---------- T4: a FOURTH defendant answers AFTER the DCO → no statutory serve clock ----------
INSERT INTO litigation.lit_party (lit_party_id, court_case_id, person_id, pleaded_name, alignment, answer_filed)
VALUES (gen_random_uuid(), :'cc', :'p1', 'TEST Defendant Four (late answer)', 'defendant', DATE '2026-08-15');
SELECT CASE WHEN count(*) = 1 THEN 'T4a PASS — late answer starts NO new serve clock (court date controls)' ELSE 'T4a FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_serve_90' AND status='pending';
SELECT CASE WHEN count(*) = 4 THEN 'T4b PASS — its counter watch DID start (counters not court-ordered)' ELSE 'T4b FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_counter_120' AND status='pending';

-- ---------- T5: amended order also sets a counter date → counters fall too ----------
INSERT INTO litigation.scheduling_order (scheduling_order_id, court_case_id, order_type, signed_date,
  affidavit_18001_deadline, counter_affidavit_deadline, supersedes_order_id)
VALUES (gen_random_uuid(), :'cc', 'amended', DATE '2026-08-20', DATE '2026-10-15', DATE '2026-11-14', :'so1')
RETURNING scheduling_order_id AS so2 \gset
SELECT litigation.apply_scheduling_order(:'so2');
SELECT CASE WHEN count(*) = 0 THEN 'T5a PASS — all counter watches vacated by ordered counter date' ELSE 'T5a FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code='affidavit_18001_counter_120' AND source='rule' AND status='pending';
SELECT CASE WHEN count(*) = 2 THEN 'T5b PASS — amended order dockets new 18.001 + counter; prior court rows vacated' ELSE 'T5b FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm' AND rule_code LIKE 'affidavit_18001%' AND source='court_order' AND status='pending';

-- ---------- T6: legacy path — order with NO 18.001 dates leaves clocks alone ----------
SELECT client_matter_id AS cm2 FROM core.client_matter WHERE client_matter_id <> :'cm' LIMIT 1 \gset
INSERT INTO litigation.court_case (court_case_id, client_matter_id, cause_number, court_id)
VALUES (gen_random_uuid(), :'cm2', 'TEST-2026-CI-LEGACY', (SELECT court_id FROM ref.court LIMIT 1))
RETURNING court_case_id AS cc2 \gset
INSERT INTO litigation.lit_party (lit_party_id, court_case_id, person_id, pleaded_name, alignment, answer_filed)
VALUES (gen_random_uuid(), :'cc2', :'p1', 'TEST Legacy Def', 'defendant', DATE '2026-05-01');
INSERT INTO litigation.scheduling_order (scheduling_order_id, court_case_id, order_type, signed_date, discovery_close, trial_date)
VALUES (gen_random_uuid(), :'cc2', 'dco', DATE '2026-07-10', DATE '2027-01-15', DATE '2027-04-05')
RETURNING scheduling_order_id AS so3 \gset
SELECT litigation.apply_scheduling_order(:'so3');
SELECT CASE WHEN count(*) = 2 THEN 'T6 PASS — order silent on 18.001: both statutory clocks survive' ELSE 'T6 FAIL: '||count(*) END
FROM workflow.deadline WHERE client_matter_id = :'cm2' AND rule_code LIKE 'affidavit_18001%' AND source='rule' AND status='pending';
