import { createClient } from "@/lib/supabase/server";
import {
  COVERAGE_CATEGORIES,
  type CoverageCategoryCode,
} from "./coverage";
import type { TreatmentEpisodeRow } from "./types";

export type PdClaimRow = {
  pd_claim_id: string;
  vehicle_id: string;
  status: string;
  last_touch_date: string | null;
  repairable_or_total: string | null;
  estimate_amount: number | null;
  valuation_amount: number | null;
  demand_blocker: boolean;
  notes: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  current_location: string | null;
  drivable: boolean | null;
  storage_accruing: boolean;
};

export type RecordRequestRow = {
  record_request_id: string;
  treatment_episode_id: string;
  request_type: string;
  status: string;
  sent_date: string | null;
  received_date: string | null;
  follow_up_due: string | null;
  hipaa_verified: boolean;
  notes: string | null;
  provider_name: string | null;
};

export type DemandRow = {
  demand_id: string;
  demand_type: string;
  amount: number | null;
  sent_date: string | null;
  response_due: string | null;
  response_received_date: string | null;
  response_type: string | null;
  response_amount: number | null;
  reviewed_at: string | null;
  attorney_approved_at: string | null;
  notes: string | null;
};

export type NegotiationRow = {
  negotiation_event_id: string;
  event_type: string;
  amount: number | null;
  event_date: string;
  by_side: string;
  adjuster_or_counsel: string | null;
  note: string | null;
};

export type ProviderDirectoryRow = {
  provider_id: string;
  provider_type: string;
  name: string;
  accepts_lop: boolean | null;
};

export type CoverageBoxState = {
  code: CoverageCategoryCode;
  label: string;
  status: "covered" | "n_a" | "unanswered";
  episodeCount: number;
};

export async function listPdClaimsForIncident(
  incidentGroupId: string,
): Promise<PdClaimRow[]> {
  const supabase = createClient();
  const { data: vehicles, error } = await supabase
    .schema("property")
    .from("vehicle")
    .select(
      "vehicle_id, year, make, model, current_location, drivable, storage_accruing",
    )
    .eq("incident_group_id", incidentGroupId);
  if (error) throw new Error(error.message);
  if (!vehicles?.length) return [];

  const ids = vehicles.map((v) => v.vehicle_id);
  const { data: claims, error: cErr } = await supabase
    .schema("property")
    .from("pd_claim")
    .select(
      `pd_claim_id, vehicle_id, status, last_touch_date, repairable_or_total,
       estimate_amount, valuation_amount, demand_blocker, notes`,
    )
    .in("vehicle_id", ids);
  if (cErr) throw new Error(cErr.message);

  const vMap = new Map(vehicles.map((v) => [v.vehicle_id, v]));
  return (claims ?? []).map((c) => {
    const v = vMap.get(c.vehicle_id);
    return {
      pd_claim_id: c.pd_claim_id as string,
      vehicle_id: c.vehicle_id as string,
      status: c.status as string,
      last_touch_date: (c.last_touch_date as string | null) ?? null,
      repairable_or_total: (c.repairable_or_total as string | null) ?? null,
      estimate_amount:
        c.estimate_amount != null ? Number(c.estimate_amount) : null,
      valuation_amount:
        c.valuation_amount != null ? Number(c.valuation_amount) : null,
      demand_blocker: Boolean(c.demand_blocker),
      notes: (c.notes as string | null) ?? null,
      year: (v?.year as number | null) ?? null,
      make: (v?.make as string | null) ?? null,
      model: (v?.model as string | null) ?? null,
      current_location: (v?.current_location as string | null) ?? null,
      drivable: (v?.drivable as boolean | null) ?? null,
      storage_accruing: Boolean(v?.storage_accruing),
    };
  });
}

export async function listRecordRequests(
  matterId: string,
): Promise<RecordRequestRow[]> {
  const supabase = createClient();
  const { data: episodes, error: eErr } = await supabase
    .schema("medical")
    .from("treatment_episode")
    .select(
      `treatment_episode_id,
       provider:provider_id(organization:organization_id(name))`,
    )
    .eq("client_matter_id", matterId)
    .is("deleted_at", null);
  if (eErr) throw new Error(eErr.message);
  if (!episodes?.length) return [];

  const epIds = episodes.map((e) => e.treatment_episode_id);
  const nameByEp = new Map<string, string | null>();
  for (const e of episodes) {
    const p = e.provider as unknown as {
      organization?: { name?: string } | null;
    } | null;
    nameByEp.set(e.treatment_episode_id, p?.organization?.name ?? null);
  }

  const { data, error } = await supabase
    .schema("medical")
    .from("record_request")
    .select(
      `record_request_id, treatment_episode_id, request_type, status,
       sent_date, received_date, follow_up_due, hipaa_verified, notes`,
    )
    .in("treatment_episode_id", epIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    record_request_id: r.record_request_id as string,
    treatment_episode_id: r.treatment_episode_id as string,
    request_type: r.request_type as string,
    status: r.status as string,
    sent_date: (r.sent_date as string | null) ?? null,
    received_date: (r.received_date as string | null) ?? null,
    follow_up_due: (r.follow_up_due as string | null) ?? null,
    hipaa_verified: Boolean(r.hipaa_verified),
    notes: (r.notes as string | null) ?? null,
    provider_name: nameByEp.get(r.treatment_episode_id as string) ?? null,
  }));
}

export async function listDemands(matterId: string): Promise<DemandRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("resolution")
    .from("demand")
    .select(
      `demand_id, demand_type, amount, sent_date, response_due,
       response_received_date, response_type, response_amount,
       reviewed_at, attorney_approved_at, notes`,
    )
    .eq("client_matter_id", matterId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    demand_id: d.demand_id as string,
    demand_type: d.demand_type as string,
    amount: d.amount != null ? Number(d.amount) : null,
    sent_date: (d.sent_date as string | null) ?? null,
    response_due: (d.response_due as string | null) ?? null,
    response_received_date: (d.response_received_date as string | null) ?? null,
    response_type: (d.response_type as string | null) ?? null,
    response_amount:
      d.response_amount != null ? Number(d.response_amount) : null,
    reviewed_at: (d.reviewed_at as string | null) ?? null,
    attorney_approved_at: (d.attorney_approved_at as string | null) ?? null,
    notes: (d.notes as string | null) ?? null,
  }));
}

export async function listNegotiations(
  matterId: string,
): Promise<NegotiationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("resolution")
    .from("negotiation_event")
    .select(
      "negotiation_event_id, event_type, amount, event_date, by_side, adjuster_or_counsel, note",
    )
    .eq("client_matter_id", matterId)
    .order("event_date", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({
    negotiation_event_id: n.negotiation_event_id as string,
    event_type: n.event_type as string,
    amount: n.amount != null ? Number(n.amount) : null,
    event_date: n.event_date as string,
    by_side: n.by_side as string,
    adjuster_or_counsel: (n.adjuster_or_counsel as string | null) ?? null,
    note: (n.note as string | null) ?? null,
  }));
}

export async function listProviderDirectory(): Promise<ProviderDirectoryRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("medical")
    .from("provider")
    .select(
      "provider_id, provider_type, accepts_lop, organization:organization_id(name)",
    )
    .order("provider_id")
    .limit(200);
  if (error) return [];
  return (data ?? []).map((p) => {
    const org = p.organization as unknown as { name?: string } | null;
    return {
      provider_id: p.provider_id as string,
      provider_type: p.provider_type as string,
      name: org?.name ?? "Provider",
      accepts_lop: (p.accepts_lop as boolean | null) ?? null,
    };
  });
}

export async function listCoverageNa(
  matterId: string,
): Promise<CoverageCategoryCode[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("medical")
    .from("coverage_na")
    .select("category")
    .eq("client_matter_id", matterId);
  if (error) {
    // Table may not be applied yet
    return [];
  }
  return (data ?? []).map((r) => r.category as CoverageCategoryCode);
}

export function buildCoverageBoxes(
  episodes: TreatmentEpisodeRow[],
  naCategories: CoverageCategoryCode[],
): CoverageBoxState[] {
  const na = new Set(naCategories);
  return COVERAGE_CATEGORIES.map((cat) => {
    const matching = episodes.filter(
      (e) =>
        e.provider_type &&
        (cat.providerTypes as readonly string[]).includes(e.provider_type),
    );
    if (matching.length > 0) {
      return {
        code: cat.code,
        label: cat.label,
        status: "covered" as const,
        episodeCount: matching.length,
      };
    }
    if (na.has(cat.code)) {
      return {
        code: cat.code,
        label: cat.label,
        status: "n_a" as const,
        episodeCount: 0,
      };
    }
    return {
      code: cat.code,
      label: cat.label,
      status: "unanswered" as const,
      episodeCount: 0,
    };
  });
}
