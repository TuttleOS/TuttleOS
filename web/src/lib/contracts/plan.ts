import { createClient } from "@/lib/supabase/server";
import type { LeadRow } from "@/lib/intake/types";
import { leadDisplayName } from "@/lib/intake/display";
import {
  buildAdultPlainPlan,
  buildAdultWithWardsPlan,
  buildMinorCaseAPlan,
  buildMinorCaseBPlan,
  type LeadContractPlan,
  type MinorWardSummary,
} from "./capacity";

function firstLastFromLead(lead: LeadRow): string {
  if (lead.person) {
    return `${lead.person.first_name} ${lead.person.last_name}`.trim();
  }
  const dn = leadDisplayName(lead);
  if (dn.includes(",")) {
    return dn.split(",").reverse().join(" ").trim();
  }
  return dn;
}

/** Minors who name this person as next friend (Case A wards). */
export async function listMinorWardsForGuardian(
  guardianPersonId: string,
): Promise<MinorWardSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("intake_lead")
    .select(
      `intake_lead_id, person_id, is_minor, not_drivers_child, relationship_to_driver,
       person:person_id(first_name, last_name), raw_name`,
    )
    .eq("next_friend_person_id", guardianPersonId)
    .eq("is_minor", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const person = row.person as
      | { first_name: string; last_name: string }
      | { first_name: string; last_name: string }[]
      | null;
    const p = Array.isArray(person) ? person[0] : person;
    const display_name = p
      ? `${p.first_name} ${p.last_name}`.trim()
      : (row.raw_name as string | null) || "Minor";
    return {
      intake_lead_id: row.intake_lead_id as string,
      person_id: (row.person_id as string | null) ?? null,
      display_name,
      not_drivers_child: !!(row.not_drivers_child as boolean | null),
      relationship_to_driver:
        (row.relationship_to_driver as string | null) ?? null,
    };
  });
}

/**
 * Find a client lead for the guardian person (usually same crash group).
 * Prefer same incident_group; fall back to any open lead for that person.
 */
export async function findGuardianClientLead(input: {
  guardianPersonId: string;
  incidentGroupId: string | null;
  excludeLeadId: string;
}): Promise<{ intake_lead_id: string; display_name: string } | null> {
  const supabase = createClient();

  let q = supabase
    .schema("core")
    .from("intake_lead")
    .select(
      `intake_lead_id, person_id, is_minor, raw_name,
       person:person_id(first_name, last_name)`,
    )
    .eq("person_id", input.guardianPersonId)
    .is("deleted_at", null)
    .neq("intake_lead_id", input.excludeLeadId)
    .order("created_at", { ascending: true })
    .limit(20);

  if (input.incidentGroupId) {
    q = q.eq("incident_group_id", input.incidentGroupId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((r) => !r.is_minor);
  const pick = rows[0] ?? (data ?? [])[0];
  if (!pick) return null;

  const person = pick.person as
    | { first_name: string; last_name: string }
    | { first_name: string; last_name: string }[]
    | null;
  const p = Array.isArray(person) ? person[0] : person;
  const display_name = p
    ? `${p.first_name} ${p.last_name}`.trim()
    : (pick.raw_name as string | null) || "Guardian";

  return {
    intake_lead_id: pick.intake_lead_id as string,
    display_name,
  };
}

/** Resolve Call #2 Case A / Case B contract plan for a lead. */
export async function resolveLeadContractPlan(
  lead: LeadRow,
  nextFriendName?: string | null,
): Promise<LeadContractPlan> {
  const minorName = firstLastFromLead(lead);

  if (lead.is_minor) {
    if (!lead.next_friend_person_id) {
      return {
        kind: "minor_incomplete",
        message:
          "Minor client is missing an adult on the case — set the parent/guardian before drafting a contract.",
      };
    }

    const guardianLead = await findGuardianClientLead({
      guardianPersonId: lead.next_friend_person_id,
      incidentGroupId: lead.incident_group_id,
      excludeLeadId: lead.intake_lead_id,
    });

    const guardianName =
      nextFriendName?.trim() || guardianLead?.display_name || "Guardian";

    if (guardianLead) {
      return buildMinorCaseAPlan({
        guardianLeadId: guardianLead.intake_lead_id,
        guardianName,
        minorName,
      });
    }

    return buildMinorCaseBPlan({
      guardianName,
      minorName,
    });
  }

  if (!lead.person_id) {
    return buildAdultPlainPlan(minorName);
  }

  const wards = await listMinorWardsForGuardian(lead.person_id);
  // Prefer wards in the same incident group when available
  const scoped = lead.incident_group_id
    ? await filterWardsByGroup(wards, lead.incident_group_id)
    : wards;

  return buildAdultWithWardsPlan(minorName, scoped);
}

async function filterWardsByGroup(
  wards: MinorWardSummary[],
  incidentGroupId: string,
): Promise<MinorWardSummary[]> {
  if (!wards.length) return wards;
  const supabase = createClient();
  const ids = wards.map((w) => w.intake_lead_id);
  const { data } = await supabase
    .schema("core")
    .from("intake_lead")
    .select("intake_lead_id, incident_group_id")
    .in("intake_lead_id", ids)
    .is("deleted_at", null);
  const inGroup = new Set(
    (data ?? [])
      .filter((r) => r.incident_group_id === incidentGroupId)
      .map((r) => r.intake_lead_id as string),
  );
  const filtered = wards.filter((w) => inGroup.has(w.intake_lead_id));
  // If none share the group (data oddity), keep all wards for this guardian
  return filtered.length ? filtered : wards;
}
