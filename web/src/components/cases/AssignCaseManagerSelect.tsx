"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignCaseManagerAction } from "@/lib/cases/actions";
import type { AssignableStaff } from "@/lib/cases/queries";

export function AssignCaseManagerSelect({
  matterId,
  currentStaffId,
  currentName,
  options,
  canAssign,
}: {
  matterId: string;
  currentStaffId: string | null;
  currentName?: string | null;
  options: AssignableStaff[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!canAssign) {
    if (!currentStaffId) {
      return <span className="font-semibold text-danger">UNASSIGNED</span>;
    }
    return <span>{currentName ?? "Assigned"}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Assign case manager"
        disabled={pending}
        value={currentStaffId ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          setErr(null);
          start(async () => {
            const res = await assignCaseManagerAction(matterId, next);
            if (!res.ok) setErr(res.error);
            router.refresh();
          });
        }}
        className={`max-w-[11rem] rounded-md border px-1.5 py-0.5 text-sm ${
          currentStaffId
            ? "border-grid bg-surface text-ink"
            : "border-danger/40 bg-danger-bg font-semibold text-danger"
        }`}
      >
        <option value="">UNASSIGNED</option>
        {options.map((o) => (
          <option key={o.staff_id} value={o.staff_id}>
            {o.name}
            {o.role_code === "case_manager" ? "" : ` (${o.role_code.replaceAll("_", " ")})`}
          </option>
        ))}
      </select>
      {pending && <span className="text-xs text-muted">Saving…</span>}
      {err && <span className="text-xs text-danger">{err}</span>}
    </span>
  );
}
