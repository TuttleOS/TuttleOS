import type { StaffProfile, StaffRoleCode } from "@/lib/staff";
import { displayName, homePathForRole } from "@/lib/staff";

export type WorkspaceKind = "cases" | "litigation" | "owner" | "intake" | "other";

export function workspaceFromPath(pathname: string): WorkspaceKind {
  if (pathname.startsWith("/cases")) return "cases";
  if (pathname.startsWith("/litigation")) return "litigation";
  if (
    pathname.startsWith("/owner") ||
    pathname === "/test" ||
    pathname.startsWith("/test/")
  )
    return "owner";
  if (pathname.startsWith("/intake")) return "intake";
  return "other";
}

export function workspaceLabel(kind: WorkspaceKind): string {
  switch (kind) {
    case "cases":
      return "Case Manager";
    case "litigation":
      return "Litigation Paralegal";
    case "owner":
      return "Owner";
    case "intake":
      return "Intake";
    default:
      return "Workspace";
  }
}

/**
 * B1 target asymmetry (Michael call):
 * - Litigation paralegals → full Case Manager workspace
 * - Case managers → litigation milestones only (not full PL tools)
 * - Attorney / admin / senior PL → both, full
 */
export function canOpenFullCmWorkspace(role: StaffRoleCode | string): boolean {
  return (
    role === "litigation_paralegal" ||
    role === "case_manager" ||
    role === "attorney" ||
    role === "admin" ||
    role === "senior_paralegal"
  );
}

/** May open /litigation at all (CM = milestones-only surface). */
export function canOpenLitigationWorkspace(
  role: StaffRoleCode | string,
): boolean {
  return (
    role === "litigation_paralegal" ||
    role === "case_manager" ||
    role === "attorney" ||
    role === "admin" ||
    role === "senior_paralegal"
  );
}

/** Full discovery / deadline / lit task tooling (not CM). */
export function canOpenFullLitigationWorkspace(
  role: StaffRoleCode | string,
): boolean {
  return (
    role === "litigation_paralegal" ||
    role === "attorney" ||
    role === "admin" ||
    role === "senior_paralegal"
  );
}

/** Alias used by matter toggles — true if either direction is allowed. */
export function canSwitchCmLit(role: StaffRoleCode | string): boolean {
  return canOpenFullCmWorkspace(role) && canOpenLitigationWorkspace(role);
}

/** CM opens litigation as milestones-only (no discovery depth / full lit tools). */
export function litMilestonesOnly(role: StaffRoleCode | string): boolean {
  return role === "case_manager";
}

export function homeWorkspace(role: StaffRoleCode | string): WorkspaceKind {
  const home = homePathForRole(role);
  return workspaceFromPath(home);
}

/**
 * Top-bar / identity switch target when on CM or Lit.
 * Returns null if no switch should show.
 */
export function cmLitSwitchAction(
  staff: StaffProfile,
  pathname: string,
): { href: string; label: string } | null {
  if (!canSwitchCmLit(staff.role_code)) return null;
  const ws = workspaceFromPath(pathname);
  const milestones = litMilestonesOnly(staff.role_code);

  if (ws === "litigation") {
    if (!canOpenFullCmWorkspace(staff.role_code)) return null;
    return { href: "/cases", label: "🔁 Full Case Manager view" };
  }
  if (ws === "cases") {
    if (!canOpenLitigationWorkspace(staff.role_code)) return null;
    return {
      href: "/litigation",
      label: milestones
        ? "🔁 Litigation milestones"
        : "🔁 Full Litigation view",
    };
  }
  if (ws === "owner") {
    return { href: "/cases", label: "🔁 Case Manager view" };
  }
  return null;
}

/** Label for the lit side of the per-matter toggle. */
export function litToggleLabel(role: StaffRoleCode | string): string {
  return litMilestonesOnly(role) ? "Lit milestones" : "Litigation view";
}

/** Amber banner when viewing a workspace that is not the staff home role. */
export function identityBannerCopy(
  staff: StaffProfile,
  pathname: string,
): { title: string; detail: string; backHref: string; backLabel: string } | null {
  const ws = workspaceFromPath(pathname);
  const home = homeWorkspace(staff.role_code);
  if (ws === "other" || ws === "intake") return null;
  if (ws === home) return null;

  const name = displayName(staff);
  const roleLabel = staff.role_code.replaceAll("_", " ");
  const viewing = workspaceLabel(ws);

  let backHref = homePathForRole(staff.role_code);
  let backLabel = `Back to ${workspaceLabel(home)}`;

  if (staff.role_code === "litigation_paralegal" && ws === "cases") {
    backHref = "/litigation";
    backLabel = "Back to Paralegal view";
  } else if (staff.role_code === "case_manager" && ws === "litigation") {
    backHref = "/cases";
    backLabel = "Back to Case Manager view";
  }

  const detail =
    staff.role_code === "case_manager" && ws === "litigation"
      ? "Milestones-only — not full litigation tools. Audits stay under YOUR name."
      : staff.role_code === "litigation_paralegal" && ws === "cases"
        ? "Full Case Manager workspace. Audits and writes stay under YOUR name."
        : "Audits and writes stay under YOUR name. This is not impersonation.";

  return {
    title: `You are ${name} (${roleLabel}) — viewing ${viewing} workspace`,
    detail,
    backHref,
    backLabel,
  };
}
