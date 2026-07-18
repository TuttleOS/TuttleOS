import type { StaffProfile, StaffRoleCode } from "@/lib/staff";
import { displayName, homePathForRole } from "@/lib/staff";

export type WorkspaceKind = "cases" | "litigation" | "owner" | "intake" | "other";

export function workspaceFromPath(pathname: string): WorkspaceKind {
  if (pathname.startsWith("/cases")) return "cases";
  if (pathname.startsWith("/litigation")) return "litigation";
  if (pathname.startsWith("/owner")) return "owner";
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

/** Roles that may cross CM ↔ Litigation (RLS still governs data). */
export function canSwitchCmLit(role: StaffRoleCode | string): boolean {
  return (
    role === "litigation_paralegal" ||
    role === "case_manager" ||
    role === "attorney" ||
    role === "admin" ||
    role === "senior_paralegal"
  );
}

export function homeWorkspace(role: StaffRoleCode | string): WorkspaceKind {
  const home = homePathForRole(role);
  return workspaceFromPath(home);
}

/**
 * Top-bar switch target when on CM or Lit.
 * Returns null if no switch should show.
 */
export function cmLitSwitchAction(
  staff: StaffProfile,
  pathname: string,
): { href: string; label: string } | null {
  if (!canSwitchCmLit(staff.role_code)) return null;
  const ws = workspaceFromPath(pathname);
  if (ws === "litigation") {
    return { href: "/cases", label: "🔁 Case Manager view" };
  }
  if (ws === "cases") {
    return { href: "/litigation", label: "🔁 Litigation view" };
  }
  // Attorney home is owner — still offer both when elsewhere
  if (ws === "owner") {
    return { href: "/cases", label: "🔁 Case Manager view" };
  }
  return null;
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

  // PL in CM view → back to lit; CM in lit → back to cases
  if (staff.role_code === "litigation_paralegal" && ws === "cases") {
    backHref = "/litigation";
    backLabel = "Back to Paralegal view";
  } else if (staff.role_code === "case_manager" && ws === "litigation") {
    backHref = "/cases";
    backLabel = "Back to Case Manager view";
  }

  return {
    title: `You are ${name} (${roleLabel}) — viewing ${viewing} workspace`,
    detail:
      "Audits and writes stay under YOUR name. This is not impersonation.",
    backHref,
    backLabel,
  };
}

/** CM opens litigation as milestones-only (no discovery content depth). */
export function litMilestonesOnly(role: StaffRoleCode | string): boolean {
  return role === "case_manager";
}
