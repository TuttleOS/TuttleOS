"use client";

import { setRolePreviewAction } from "@/lib/role-preview-actions";
import { roleLabel, type RolePreviewState } from "@/lib/role-preview";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { displayName, type StaffProfile } from "@/lib/staff";

export function RolePreviewBanner({
  realStaff,
  preview,
  scopedName,
}: {
  realStaff: StaffProfile;
  preview: RolePreviewState;
  scopedName?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const you = displayName(realStaff);

  return (
    <div className="border-b border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            Previewing as {roleLabel(preview.role)}
            {scopedName ? ` · ${scopedName}` : ""}
          </p>
          <p className="text-xs text-muted">
            You are still {you} ({roleLabel(realStaff.role_code)}). Nav mirrors
            the role
            {scopedName
              ? "; caseload scoped to that person’s assignments"
              : preview.role === "case_manager" ||
                  preview.role === "litigation_paralegal"
                ? "; pick a person in the menu to scope caseload"
                : ""}
            . Writes and audit stay under your name — not impersonation.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            start(async () => {
              const res = await setRolePreviewAction({ role: null });
              if (res.ok) {
                router.push(res.home);
                router.refresh();
              }
            });
          }}
          className="shrink-0 rounded-lg border border-grid bg-surface px-3 py-1.5 text-xs font-bold hover:bg-surface-2"
        >
          Exit preview
        </button>
      </div>
    </div>
  );
}
