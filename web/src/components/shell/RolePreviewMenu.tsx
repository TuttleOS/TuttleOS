"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { StaffProfile } from "@/lib/staff";
import { displayName } from "@/lib/staff";
import { setRolePreviewAction } from "@/lib/role-preview-actions";
import {
  roleLabel,
  type RolePreviewState,
  type RoleRosterGroup,
} from "@/lib/role-preview";

export function RolePreviewMenu({
  realStaff,
  preview,
  roster,
}: {
  realStaff: StaffProfile;
  preview: RolePreviewState | null;
  roster: RoleRosterGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const name = displayName(realStaff);
  const shownRole = preview?.role ?? realStaff.role_code;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(role: RolePreviewState["role"] | null, asStaffId?: string) {
    setErr(null);
    start(async () => {
      const res = await setRolePreviewAction({
        role,
        asStaffId: asStaffId ?? null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpen(false);
      router.push(res.home);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative text-right leading-tight">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg px-1.5 py-0.5 text-right hover:bg-surface-2"
        title="Preview another role’s workspace"
      >
        <div className="font-semibold">{name}</div>
        <div className="text-xs text-muted">
          {roleLabel(shownRole)}
          {preview ? " · preview" : ""}
          <span className="ml-1 text-[10px] opacity-70" aria-hidden>
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Role roster and preview"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-panel border border-grid bg-surface p-3 text-left shadow-soft"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
            Role roster
          </p>
          <p className="mt-1 text-xs text-muted">
            Preview nav and caseload for a role. Click a{" "}
            <strong className="font-semibold text-ink">person</strong> under
            Case Manager / Litigation to see their assigned matters (e.g. Camila
            Manager). You stay{" "}
            <strong className="font-semibold text-ink">{name}</strong> — writes
            and audit still use your attorney account.
          </p>

          {preview && (
            <button
              type="button"
              disabled={pending}
              onClick={() => apply(null)}
              className="mt-3 w-full rounded-lg border border-grid bg-surface-2 px-3 py-2 text-xs font-semibold hover:bg-page"
            >
              Exit preview → back to {roleLabel(realStaff.role_code)}
            </button>
          )}

          {err && (
            <p className="mt-2 text-xs text-danger">{err}</p>
          )}

          <div className="mt-3 max-h-[min(70vh,28rem)] space-y-3 overflow-auto">
            {roster.map((group) => (
              <div key={group.role}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    title={
                      group.people[0]
                        ? `Preview as ${group.people[0].name} (first holder — pick another below to change)`
                        : `Preview ${group.label} workspace`
                    }
                    onClick={() =>
                      apply(
                        group.role,
                        // Assigned-only roles need a person or queues stay empty
                        group.people[0]?.staff_id,
                      )
                    }
                    className={`text-left text-sm font-semibold hover:underline ${
                      preview?.role === group.role &&
                      (preview.asStaffId === group.people[0]?.staff_id ||
                        (!preview.asStaffId && !group.people[0]))
                        ? "text-accent-dk"
                        : "text-ink"
                    }`}
                  >
                    {group.label}
                  </button>
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {group.home}
                  </span>
                </div>
                {group.people.length === 0 ? (
                  <p className="mt-1 text-xs text-muted">No active staff</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {group.people.map((person) => {
                      const active =
                        preview?.role === group.role &&
                        preview.asStaffId === person.staff_id;
                      return (
                        <li key={`${group.role}-${person.staff_id}`}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => apply(group.role, person.staff_id)}
                            className={`w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-2 ${
                              active ? "bg-accent/10 font-semibold" : ""
                            }`}
                          >
                            <span className="text-ink">{person.name}</span>
                            {person.email && (
                              <span className="mt-0.5 block truncate text-[10px] text-muted">
                                {person.email}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
