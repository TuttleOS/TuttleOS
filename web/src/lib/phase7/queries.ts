import { createClient } from "@/lib/supabase/server";

export type DemandReadinessRow = {
  client_matter_id: string;
  display_name: string | null;
  approved_level: number | null;
  treatment_complete: boolean | null;
  records_outstanding: number | null;
  pd_clear: boolean | null;
  demand_id: string | null;
  kate_reviewed: boolean | null;
  needs_attorney_approval: boolean | null;
  attorney_approved: boolean | null;
};

export type LienWorklistRow = {
  lien_id: string;
  client_matter_id: string;
  display_name: string | null;
  lien_type: string | null;
  holder: string | null;
  status: string;
  asserted_amount: number | null;
  verified_amount: number | null;
  negotiated_amount: number | null;
  flagged_for_resolution_date: string | null;
  current_stage_code: string | null;
  matter_settled: boolean | null;
};

export type ViabilityQueueRow = {
  viability_review_id: string;
  client_matter_id: string;
  due_date: string;
  prep_status: string;
  cm_recommendation: string | null;
  cm_recommended_level: number | null;
  reviewed_at: string | null;
  display_name: string;
  current_stage_code: string;
};

export async function listDemandReadiness(): Promise<DemandReadinessRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("resolution")
    .from("v_demand_readiness")
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as DemandReadinessRow[];
}

export async function listLienWorklist(): Promise<LienWorklistRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("liens")
    .from("v_lien_worklist")
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as LienWorklistRow[];
}

export async function listOpenViabilityReviews(): Promise<ViabilityQueueRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("viability_review")
    .select(
      "viability_review_id, client_matter_id, due_date, prep_status, cm_recommendation, cm_recommended_level, reviewed_at",
    )
    .is("reviewed_at", null)
    .order("due_date", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.client_matter_id);
  const { data: matters } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      "client_matter_id, current_stage_code, matter_number, person:client_person_id(last_name, first_name)",
    )
    .in("client_matter_id", ids);

  const labels = new Map<string, { name: string; stage: string }>();
  for (const m of matters ?? []) {
    const p = m.person as unknown as {
      last_name: string;
      first_name: string;
    } | null;
    labels.set(m.client_matter_id, {
      name: p
        ? `${p.last_name}, ${p.first_name}`
        : (m.matter_number ?? "Matter"),
      stage: m.current_stage_code,
    });
  }

  return rows.map((r) => {
    const meta = labels.get(r.client_matter_id);
    return {
      ...r,
      display_name: meta?.name ?? "Matter",
      current_stage_code: meta?.stage ?? "—",
    };
  });
}
