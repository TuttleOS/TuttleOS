import Link from "next/link";
import { litToggleLabel } from "@/lib/workspace";
import type { StaffRoleCode } from "@/lib/staff";

/** Persistent CM ↔ Litigation matter view toggle (same client_matter_id). */
export function MatterViewToggle({
  matterId,
  active,
  viewerRole,
}: {
  matterId: string;
  active: "cases" | "litigation";
  viewerRole?: StaffRoleCode | string;
}) {
  const litLabel = viewerRole ? litToggleLabel(viewerRole) : "Litigation view";

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-grid text-xs font-semibold">
      <Link
        href={`/cases/${matterId}`}
        className={`px-3 py-1.5 no-underline ${
          active === "cases"
            ? "bg-accent-dk text-white"
            : "bg-surface text-ink hover:bg-surface-2"
        }`}
      >
        CM view
      </Link>
      <Link
        href={`/litigation/${matterId}`}
        className={`border-l border-grid px-3 py-1.5 no-underline ${
          active === "litigation"
            ? "bg-accent-dk text-white"
            : "bg-surface text-ink hover:bg-surface-2"
        }`}
        title={
          viewerRole === "case_manager"
            ? "Milestones only — not full litigation tools"
            : undefined
        }
      >
        {litLabel}
      </Link>
    </div>
  );
}
