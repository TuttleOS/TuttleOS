import type { CalendarAdapter } from "./adapter";
import type { DeadlineCalendarEvent, SyncResult } from "./types";
import { DryRunCalendarAdapter } from "./dryRunAdapter";

/**
 * Microsoft Graph adapter stub.
 * Live create/update requires MICROSOFT_GRAPH_* + org DPA (gate 9.1).
 */
export class GraphCalendarAdapter implements CalendarAdapter {
  readonly provider = "microsoft_graph" as const;
  private fallback = new DryRunCalendarAdapter();

  private liveReady(): boolean {
    return Boolean(
      process.env.MICROSOFT_GRAPH_CLIENT_ID &&
        process.env.MICROSOFT_GRAPH_CLIENT_SECRET &&
        process.env.MICROSOFT_GRAPH_TENANT_ID &&
        process.env.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC === "true",
    );
  }

  async upsert(event: DeadlineCalendarEvent): Promise<SyncResult> {
    if (!this.liveReady()) {
      const r = await this.fallback.upsert(event);
      return { ...r, provider: "microsoft_graph", dryRun: true };
    }
    return {
      ok: false,
      provider: "microsoft_graph",
      externalEventId: null,
      dryRun: false,
      error:
        "Graph live upsert not implemented yet — wire OAuth after DPA (gate 9.1).",
    };
  }

  async cancel(externalEventId: string, deadlineId: string): Promise<SyncResult> {
    if (!this.liveReady()) {
      const r = await this.fallback.cancel(externalEventId, deadlineId);
      return { ...r, provider: "microsoft_graph", dryRun: true };
    }
    return {
      ok: false,
      provider: "microsoft_graph",
      externalEventId,
      dryRun: false,
      error: "Graph live cancel not implemented yet.",
    };
  }
}
