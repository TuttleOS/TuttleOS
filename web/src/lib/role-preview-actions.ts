"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/lib/staff-server";
import { homePathForRole, type StaffRoleCode } from "@/lib/staff";
import {
  PREVIEWABLE_ROLES,
  ROLE_PREVIEW_COOKIE,
  canUseRolePreview,
  type RolePreviewState,
} from "@/lib/role-preview";

export type PreviewActionResult =
  | { ok: true; home: string }
  | { ok: false; error: string };

export async function setRolePreviewAction(input: {
  role: StaffRoleCode | null;
  asStaffId?: string | null;
}): Promise<PreviewActionResult> {
  const staff = await getCurrentStaff();
  if (!staff) return { ok: false, error: "Not signed in" };
  if (!canUseRolePreview(staff)) {
    return { ok: false, error: "Role preview is attorney / admin only" };
  }

  const jar = cookies();
  if (!input.role) {
    jar.delete(ROLE_PREVIEW_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true, home: homePathForRole(staff.role_code) };
  }

  if (!PREVIEWABLE_ROLES.includes(input.role)) {
    return { ok: false, error: "That role cannot be previewed" };
  }

  const state: RolePreviewState = {
    role: input.role,
    asStaffId: input.asStaffId || undefined,
  };
  jar.set(ROLE_PREVIEW_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  revalidatePath("/", "layout");
  return { ok: true, home: homePathForRole(input.role) };
}
