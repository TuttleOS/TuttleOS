import type { CalendarAdapter } from "./adapter";
import type { DeadlineCalendarEvent, SyncResult } from "./types";
import { DryRunCalendarAdapter } from "./dryRunAdapter";

/**
 * Google Calendar adapter stub.
 * Live create/update requires GOOGLE_CALENDAR_* + org DPA (gate 9.1).
 */
export class GoogleCalendarAdapter implements CalendarAdapter {
  readonly provider = "google_calendar" as const;
  private fallback = new DryRunCalendarAdapter();

  private liveReady(): boolean {
    return Boolean(
      process.env.GOOGLE_CALENDAR_CLIENT_ID &&
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
        process.env.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC === "true",
    );
  }

  async upsert(event: DeadlineCalendarEvent): Promise<SyncResult> {
    if (!this.liveReady()) {
      const r = await this.fallback.upsert(event);
      return { ...r, provider: "google_calendar", dryRun: true };
    }
    return {
      ok: false,
      provider: "google_calendar",
      externalEventId: null,
      dryRun: false,
      error:
        "Google live upsert not implemented yet — wire OAuth after DPA (gate 9.1).",
    };
  }

  async cancel(externalEventId: string, deadlineId: string): Promise<SyncResult> {
    if (!this.liveReady()) {
      const r = await this.fallback.cancel(externalEventId, deadlineId);
      return { ...r, provider: "google_calendar", dryRun: true };
    }
    return {
      ok: false,
      provider: "google_calendar",
      externalEventId,
      dryRun: false,
      error: "Google live cancel not implemented yet.",
    };
  }
}
