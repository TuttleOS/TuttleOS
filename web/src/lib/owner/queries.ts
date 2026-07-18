import { createClient } from "@/lib/supabase/server";
import type { StalledRow } from "@/lib/cases/types";
import type {
  ApprovalItem,
  DemandApproval,
  LevelApproval,
  OverridePattern,
  SolRow,
} from "./types";

export async function listFirmStalled(): Promise<StalledRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("v_stalled_cases")
    .select("*");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as StalledRow[];
  if (!rows.length) return [];

  // Prefer person name over email for CM column
  const ids = rows.map((r) => r.client_matter_id);
  const { data: assigns } = await supabase
    .schema("core")
    .from("staff_assignment")
    .select(
      `client_matter_id, assignment_role,
       staff:staff_id(email, person:person_id(first_name, last_name))`,
    )
    .in("client_matter_id", ids)
    .eq("assignment_role", "case_manager")
    .is("ended_at", null)
    .is("deleted_at", null);

  const cmName = new Map<string, string>();
  for (const a of assigns ?? []) {
    const staff = a.staff as unknown as {
      email?: string;
      person?: { first_name: string; last_name: string } | null;
    } | null;
    const name = staff?.person
      ? `${staff.person.first_name} ${staff.person.last_name}`
      : staff?.email;
    if (name) cmName.set(a.client_matter_id, name);
  }

  return rows.map((r) => ({
    ...r,
    case_manager: cmName.get(r.client_matter_id) ?? r.case_manager,
  }));
}

export async function listSolWatch(): Promise<SolRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("v_sol_reconciliation")
    .select("*");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as SolRow[];
  const rank = (r: SolRow) => {
    if (r.reconciliation === "STORED_LATER_REVIEW_tolling_or_error") return 0;
    if (r.reconciliation === "no_stored_value") return 1;
    if (r.reconciliation === "no_computation") return 2;
    if (r.reconciliation === "stored_earlier_conservative") return 3;
    return 4;
  };
  return rows.sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    const aSol = a.stored_sol ?? a.computed_sol ?? "9999";
    const bSol = b.stored_sol ?? b.computed_sol ?? "9999";
    return aSol.localeCompare(bSol);
  });
}

export async function listPendingApprovals(): Promise<ApprovalItem[]> {
  const supabase = createClient();
  const items: ApprovalItem[] = [];

  const { data: levels, error: lErr } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, current_stage_code, recommended_level,
       recommended_level_rationale, approved_level,
       person:client_person_id(first_name, last_name), matter_number`,
    )
    .is("deleted_at", null)
    .eq("representation_status", "active")
    .neq("current_stage_code", "closed")
    .not("recommended_level", "is", null)
    .is("approved_level", null);
  if (lErr) throw new Error(lErr.message);

  for (const m of levels ?? []) {
    const person = m.person as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    items.push({
      kind: "level",
      client_matter_id: m.client_matter_id,
      display_name: person
        ? `${person.last_name}, ${person.first_name}`
        : (m.matter_number ?? "Matter"),
      current_stage_code: m.current_stage_code,
      recommended_level: m.recommended_level as number,
      recommended_level_rationale: m.recommended_level_rationale,
      approved_level: m.approved_level,
    } satisfies LevelApproval);
  }

  const { data: demands, error: dErr } = await supabase
    .schema("resolution")
    .from("v_demand_readiness")
    .select("*");
  if (dErr) throw new Error(dErr.message);

  for (const d of demands ?? []) {
    if (
      d.needs_attorney_approval &&
      d.kate_reviewed &&
      !d.attorney_approved &&
      d.demand_id
    ) {
      items.push({
        kind: "l3_demand",
        client_matter_id: d.client_matter_id,
        display_name: d.display_name ?? "Matter",
        demand_id: d.demand_id,
        approved_level: d.approved_level,
        kate_reviewed: !!d.kate_reviewed,
      } satisfies DemandApproval);
    }
  }

  return items;
}

export async function listOverridePatterns(): Promise<OverridePattern[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("v_task_override_patterns")
    .select("*")
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as OverridePattern[];
}

export function ownerTiles(
  stalled: StalledRow[],
  approvals: ApprovalItem[],
  sol: SolRow[],
) {
  return {
    active: stalled.length,
    solSoon: stalled.filter((r) => r.flag_sol_within_120d).length,
    missingLevel: stalled.filter((r) => r.flag_missing_level).length,
    viability: stalled.filter((r) => r.flag_viability_overdue).length,
    pendingApprovals: approvals.length,
    solMismatches: sol.filter((r) => r.reconciliation !== "match").length,
  };
}
