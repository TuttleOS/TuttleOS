-- Phase 9 — Calendar sync scaffolding (v2.7)
-- Maps workflow.deadline ↔ firm calendar (Graph / Google). Live push needs vendor DPA.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.staff_id', '00000000-0000-0000-0000-00000000c0de', true);

CREATE TABLE IF NOT EXISTS workflow.calendar_connection (
  calendar_connection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK
    (provider IN ('microsoft_graph', 'google_calendar', 'dry_run')),
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'dry_run' CHECK (mode IN ('dry_run', 'live')),
  calendar_id text,
  dpa_on_file boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT calendar_connection_provider_uq UNIQUE (provider)
);

CREATE TABLE IF NOT EXISTS workflow.deadline_calendar_sync (
  deadline_calendar_sync_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id uuid NOT NULL
    REFERENCES workflow.deadline(deadline_id) ON DELETE CASCADE,
  calendar_connection_id uuid NOT NULL
    REFERENCES workflow.calendar_connection(calendar_connection_id) ON DELETE CASCADE,
  external_event_id text,
  last_payload_hash text,
  last_synced_at timestamptz,
  last_error text,
  sync_status text NOT NULL DEFAULT 'pending' CHECK
    (sync_status IN ('pending', 'synced', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deadline_calendar_sync_uq UNIQUE (deadline_id, calendar_connection_id)
);

CREATE INDEX IF NOT EXISTS idx_deadline_cal_sync_status
  ON workflow.deadline_calendar_sync (sync_status)
  WHERE sync_status IN ('pending', 'failed');

SELECT core.instrument_table(
  'workflow', 'calendar_connection', 'calendar_connection_id', 'calendar_connection');
SELECT core.instrument_table(
  'workflow', 'deadline_calendar_sync', 'deadline_calendar_sync_id', 'deadline_calendar_sync');

GRANT SELECT, INSERT, UPDATE ON workflow.calendar_connection TO app_staff;
GRANT SELECT, INSERT, UPDATE ON workflow.deadline_calendar_sync TO app_staff;
GRANT SELECT, INSERT, UPDATE ON workflow.calendar_connection TO authenticated;
GRANT SELECT, INSERT, UPDATE ON workflow.deadline_calendar_sync TO authenticated;

-- Default dry-run connection (idempotent)
INSERT INTO workflow.calendar_connection (
  calendar_connection_id, provider, enabled, mode, dpa_on_file, notes
)
VALUES (
  '00000000-0000-0000-0000-00000000ca01',
  'dry_run',
  true,
  'dry_run',
  false,
  'Phase 9 default — logs intended calendar payloads; no vendor API calls.'
)
ON CONFLICT (provider) DO NOTHING;

COMMIT;
