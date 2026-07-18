import type { DeadlineCalendarEvent, SyncResult } from "./types";

export interface CalendarAdapter {
  readonly provider: SyncResult["provider"];
  upsert(event: DeadlineCalendarEvent): Promise<SyncResult>;
  cancel(externalEventId: string, deadlineId: string): Promise<SyncResult>;
}
