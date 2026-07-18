export type CalendarProvider =
  | "microsoft_graph"
  | "google_calendar"
  | "dry_run";

export type CalendarMode = "dry_run" | "live";

/** PHI-minimized payload for firm calendar (no medical narrative). */
export type DeadlineCalendarEvent = {
  deadlineId: string;
  /** Title: deadline label + matter number only — not notes / clinical text */
  title: string;
  /** Short body: stage + source + ATTORNEY-VERIFY if rule-based */
  body: string;
  effectiveDate: string; // YYYY-MM-DD
  allDay: true;
  jurisdictional: boolean;
  status: string;
  matterId: string | null;
  deepLinkPath: string | null;
};

export type SyncResult = {
  ok: boolean;
  provider: CalendarProvider;
  externalEventId: string | null;
  dryRun: boolean;
  error?: string;
  loggedPayload?: DeadlineCalendarEvent;
};

export type CalendarConnectionRow = {
  calendar_connection_id: string;
  provider: CalendarProvider;
  enabled: boolean;
  mode: CalendarMode;
  calendar_id: string | null;
  dpa_on_file: boolean;
  notes: string | null;
};

export type DeadlineSyncRow = {
  deadline_calendar_sync_id: string;
  deadline_id: string;
  calendar_connection_id: string;
  external_event_id: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  sync_status: "pending" | "synced" | "failed" | "cancelled";
  deadline_label?: string | null;
};
