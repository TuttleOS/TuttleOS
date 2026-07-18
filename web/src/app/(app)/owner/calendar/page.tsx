import { redirect } from "next/navigation";
import { CalendarSyncSettings } from "@/components/owner/CalendarSyncSettings";
import {
  calendarFeatureEnabled,
  listCalendarConnections,
  listRecentSyncFailures,
} from "@/lib/calendar/syncDeadline";
import type {
  CalendarConnectionRow,
  DeadlineSyncRow,
} from "@/lib/calendar/types";
import { getCurrentStaff } from "@/lib/staff-server";

export default async function OwnerCalendarPage() {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  if (!staff.is_attorney && staff.role_code !== "admin") {
    redirect("/owner");
  }

  let connections: CalendarConnectionRow[] = [];
  let failures: DeadlineSyncRow[] = [];
  let error: string | null = null;
  try {
    connections = await listCalendarConnections();
    failures = await listRecentSyncFailures();
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Calendar tables missing — apply sql/08_upgrade_v2.7_calendar_sync.sql";
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <CalendarSyncSettings
        connections={connections}
        failures={failures}
        featureFlagOn={calendarFeatureEnabled()}
      />
    </div>
  );
}
