import type { CalendarAdapter } from "./adapter";
import type { DeadlineCalendarEvent, SyncResult } from "./types";

/** Logs intended payload; never calls a vendor API. */
export class DryRunCalendarAdapter implements CalendarAdapter {
  readonly provider = "dry_run" as const;

  async upsert(event: DeadlineCalendarEvent): Promise<SyncResult> {
    console.info("[calendar:dry_run] upsert", {
      deadlineId: event.deadlineId,
      title: event.title,
      effectiveDate: event.effectiveDate,
      status: event.status,
    });
    return {
      ok: true,
      provider: "dry_run",
      externalEventId: `dry-${event.deadlineId}`,
      dryRun: true,
      loggedPayload: event,
    };
  }

  async cancel(externalEventId: string, deadlineId: string): Promise<SyncResult> {
    console.info("[calendar:dry_run] cancel", { externalEventId, deadlineId });
    return {
      ok: true,
      provider: "dry_run",
      externalEventId,
      dryRun: true,
    };
  }
}
