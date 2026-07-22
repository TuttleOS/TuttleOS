import { createClient } from "@/lib/supabase/server";
import type {
  CaseloadRow,
  ClaimRow,
  CmQueueCounts,
  LiabilityPendingQueueRow,
  LorPendingQueueRow,
  MatterDetail,
  NewCaseQueueRow,
  PdPendingQueueRow,
  ProviderCallDue,
  RecordsPendingQueueRow,
  StalledRow,
  TaskRow,
  TeamMember,
  TreatmentEpisodeRow,
} from "./types";
import { STAGE_LABEL } from "./types";

export { STAGE_LABEL };

const LIABILITY_CLAIM_ROLES = [
  "dinsco_liability",
  "pinsco_liability",
  "umbrella",
] as const;

function daysBetween(isoDateOrTs: string, now = new Date()): number {
  const raw = isoDateOrTs.includes("T")
    ? isoDateOrTs.slice(0, 10)
    : isoDateOrTs;
  const start = new Date(`${raw}T12:00:00`);
  return Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / 86400000),
  );
}

function isLorTaskTitle(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("lor") && t.startsWith("send");
}

function claimRolesForLorTitle(title: string): string[] {
  const t = title.toLowerCase();
  if (t.includes("pinsco")) {
    return ["pinsco_liability", "pip", "um_uim", "medpay", "pd_pinsco"];
  }
  if (t.includes("dinsco")) {
    return ["dinsco_liability", "pd_dinsco", "umbrella"];
  }
  return [];
}

type MatterLabel = {
  client_matter_id: string;
  matter_number: string | null;
  incident_group_id: string;
  display_name: string;
  date_of_loss: string | null;
};

async function loadCmMatterLabels(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<MatterLabel[]> {
  const supabase = createClient();

  let assignQ = supabase
    .schema("core")
    .from("staff_assignment")
    .select("client_matter_id")
    .eq("assignment_role", "case_manager")
    .is("ended_at", null);
  if (opts.assignedOnly) {
    assignQ = assignQ.eq("staff_id", opts.staffId);
  }

  const { data: assigns, error: aErr } = await assignQ;
  if (aErr) throw new Error(aErr.message);
  const matterIds = (assigns ?? []).map((a) => a.client_matter_id as string);
  if (matterIds.length === 0) return [];

  const { data: matters, error: mErr } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, matter_number, incident_group_id,
       person:client_person_id(first_name, last_name),
       incident:incident_group_id(date_of_loss)`,
    )
    .in("client_matter_id", matterIds)
    .is("deleted_at", null)
    .neq("representation_status", "declined");
  if (mErr) throw new Error(mErr.message);

  return (matters ?? []).map((m) => {
    const person = m.person as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const incident = m.incident as unknown as {
      date_of_loss: string | null;
    } | null;
    return {
      client_matter_id: m.client_matter_id as string,
      matter_number: (m.matter_number as string | null) ?? null,
      incident_group_id: m.incident_group_id as string,
      display_name: person
        ? `${person.last_name}, ${person.first_name}`
        : ((m.matter_number as string | null) ?? "Matter"),
      date_of_loss: incident?.date_of_loss ?? null,
    };
  });
}

export async function listCaseload(opts?: {
  staffId?: string;
  /** When true, only matters where this staff is active case_manager */
  assignedOnly?: boolean;
}): Promise<CaseloadRow[]> {
  const supabase = createClient();

  let matterIds: string[] | null = null;
  if (opts?.assignedOnly && opts.staffId) {
    const { data: assigns, error: aErr } = await supabase
      .schema("core")
      .from("staff_assignment")
      .select("client_matter_id")
      .eq("staff_id", opts.staffId)
      .eq("assignment_role", "case_manager")
      .is("ended_at", null)
      .is("deleted_at", null);
    if (aErr) throw new Error(aErr.message);
    matterIds = (assigns ?? []).map((a) => a.client_matter_id);
    if (matterIds.length === 0) return [];
  }

  let stalledQ = supabase.schema("workflow").from("v_stalled_cases").select("*");
  if (matterIds) stalledQ = stalledQ.in("client_matter_id", matterIds);

  const { data: stalled, error: sErr } = await stalledQ;
  if (sErr) throw new Error(sErr.message);
  const rows = (stalled ?? []) as StalledRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.client_matter_id);

  const { data: matters, error: mErr } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, matter_number, sol_date, sol_status, sign_up_date,
       minor_or_incapacitated, incident_group_id, client_person_id,
       person:client_person_id(preferred_language),
       incident:incident_group_id(date_of_loss, case_type_code)`,
    )
    .in("client_matter_id", ids);
  if (mErr) throw new Error(mErr.message);

  const { data: assigns } = await supabase
    .schema("core")
    .from("staff_assignment")
    .select(
      `client_matter_id, assignment_role,
       staff:staff_id(staff_id, email, person:person_id(first_name, last_name))`,
    )
    .in("client_matter_id", ids)
    .is("ended_at", null)
    .is("deleted_at", null);

  const { data: openTasks } = await supabase
    .schema("workflow")
    .from("task")
    .select("client_matter_id")
    .in("client_matter_id", ids)
    .in("status", ["open", "in_progress"])
    .is("deleted_at", null);

  const matterMap = new Map(
    (matters ?? []).map((m) => [m.client_matter_id, m] as const),
  );

  const teamByMatter = new Map<string, { cm?: string; pl?: string }>();
  for (const a of assigns ?? []) {
    const staff = a.staff as unknown as {
      email?: string;
      person?: { first_name: string; last_name: string } | null;
    } | null;
    const name = staff?.person
      ? `${staff.person.first_name} ${staff.person.last_name}`
      : (staff?.email ?? null);
    const slot = teamByMatter.get(a.client_matter_id) ?? {};
    if (a.assignment_role === "case_manager") slot.cm = name ?? undefined;
    if (
      a.assignment_role === "litigation_paralegal" ||
      a.assignment_role === "senior_paralegal"
    ) {
      slot.pl = name ?? undefined;
    }
    teamByMatter.set(a.client_matter_id, slot);
  }

  const checklistCount = new Map<string, number>();
  for (const t of openTasks ?? []) {
    if (!t.client_matter_id) continue;
    checklistCount.set(
      t.client_matter_id,
      (checklistCount.get(t.client_matter_id) ?? 0) + 1,
    );
  }

  // Companion counts per incident group
  const igIds = Array.from(
    new Set(
      (matters ?? [])
        .map((m) => m.incident_group_id as string)
        .filter(Boolean),
    ),
  );
  const companionByIg = new Map<string, number>();
  if (igIds.length) {
    const { data: companions } = await supabase
      .schema("core")
      .from("client_matter")
      .select("incident_group_id")
      .in("incident_group_id", igIds)
      .is("deleted_at", null)
      .neq("representation_status", "declined");
    for (const c of companions ?? []) {
      companionByIg.set(
        c.incident_group_id,
        (companionByIg.get(c.incident_group_id) ?? 0) + 1,
      );
    }
  }

  return rows.map((r) => {
    const m = matterMap.get(r.client_matter_id) as
      | {
          matter_number: string | null;
          sol_date: string | null;
          sol_status: string | null;
          sign_up_date: string | null;
          minor_or_incapacitated: boolean;
          incident_group_id: string;
          person?: { preferred_language: string } | null;
          incident?: { date_of_loss: string; case_type_code: string } | null;
        }
      | undefined;
    const team = teamByMatter.get(r.client_matter_id);
    return {
      ...r,
      matter_number: m?.matter_number ?? null,
      sol_date: m?.sol_date ?? null,
      sol_status: m?.sol_status ?? null,
      sign_up_date: m?.sign_up_date ?? null,
      minor_or_incapacitated: m?.minor_or_incapacitated ?? false,
      preferred_language: m?.person?.preferred_language ?? null,
      case_type_code: m?.incident?.case_type_code ?? null,
      date_of_loss: m?.incident?.date_of_loss ?? null,
      cm_name: team?.cm ?? r.case_manager,
      pl_name: team?.pl ?? null,
      companion_count: m?.incident_group_id
        ? (companionByIg.get(m.incident_group_id) ?? 1)
        : 1,
      open_checklist: checklistCount.get(r.client_matter_id) ?? 0,
    };
  });
}

export async function getMatter(id: string): Promise<MatterDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, matter_number, incident_group_id, client_person_id,
       current_stage_code, stage_entered_at, sign_up_date, contract_signed_date,
       sol_date, sol_status, approved_level, recommended_level,
       minor_or_incapacitated, in_person_signing, representation_status,
       person:client_person_id(person_id, first_name, last_name, middle_name, date_of_birth, preferred_language),
       incident:incident_group_id(date_of_loss, case_type_code, incident_city, incident_county, incident_location_description)`,
    )
    .eq("client_matter_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const person = data.person as unknown as MatterDetail["person"];
  const display_name = person
    ? `${person.last_name}, ${person.first_name}`
    : (data.matter_number ?? "Matter");

  return {
    ...(data as unknown as Omit<MatterDetail, "display_name" | "person" | "incident">),
    person,
    incident: data.incident as unknown as MatterDetail["incident"],
    display_name,
  };
}

export async function getMatterTeam(matterId: string): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("staff_assignment")
    .select(
      `assignment_role, staff_id,
       staff:staff_id(email, person:person_id(first_name, last_name))`,
    )
    .eq("client_matter_id", matterId)
    .is("ended_at", null)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  return (data ?? []).map((a) => {
    const staff = a.staff as unknown as {
      email: string | null;
      person?: { first_name: string; last_name: string } | null;
    } | null;
    return {
      assignment_role: a.assignment_role,
      staff_id: a.staff_id,
      email: staff?.email ?? null,
      name: staff?.person
        ? `${staff.person.first_name} ${staff.person.last_name}`
        : (staff?.email ?? "Unassigned"),
    };
  });
}

export type AssignableStaff = {
  staff_id: string;
  name: string;
  role_code: string;
};

/** Active staff who can be assigned as case manager on a matter. */
export async function listAssignableCaseManagers(): Promise<AssignableStaff[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("staff")
    .select(
      "staff_id, role_code, email, person:person_id(first_name, last_name)",
    )
    .eq("active", true)
    .is("deleted_at", null)
    .is("separated_date", null)
    .in("role_code", [
      "case_manager",
      "attorney",
      "admin",
      "senior_paralegal",
    ])
    .order("email");
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((s) => {
      const person = s.person as unknown as {
        first_name: string;
        last_name: string;
      } | null;
      const name = person
        ? `${person.first_name} ${person.last_name}`.trim()
        : (s.email ?? "Staff");
      return {
        staff_id: s.staff_id as string,
        name,
        role_code: s.role_code as string,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPersonContacts(personId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("contact_point")
    .select(
      "contact_point_id, kind, phone, phone_e164, email, is_primary, address_line1, address_line2, city, state, zip, valid_from, valid_to, deleted_at, updated_at",
    )
    .eq("person_id", personId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  const phone =
    data?.find((c) => c.kind === "phone" && c.is_primary) ??
    data?.find((c) => c.kind === "phone") ??
    null;
  const email =
    data?.find((c) => c.kind === "email" && c.is_primary) ??
    data?.find((c) => c.kind === "email") ??
    null;
  const address =
    data?.find((c) => c.kind === "address" && c.is_primary) ??
    data?.find((c) => c.kind === "address") ??
    null;
  return { phone, email, address };
}

/** Prior / superseded phone, email, or address rows for history strip. */
export async function listContactHistory(
  personId: string,
  kind: "phone" | "email" | "address",
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("contact_point")
    .select(
      "contact_point_id, phone, email, address_line1, address_line2, city, state, zip, valid_from, valid_to, deleted_at, updated_at, is_primary",
    )
    .eq("person_id", personId)
    .eq("kind", kind)
    .not("deleted_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (error) return [];
  return data ?? [];
}

export async function listMatterTasks(matterId: string): Promise<TaskRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("task")
    .select(
      "task_id, client_matter_id, title, description, task_type, due_date, priority, status, trigger_source, completion_method, override_reason, completed_at",
    )
    .eq("client_matter_id", matterId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export async function listMyTasks(staffId: string): Promise<TaskRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("task")
    .select(
      "task_id, client_matter_id, title, description, task_type, due_date, priority, status, trigger_source, completion_method, override_reason, completed_at",
    )
    .eq("owner_staff_id", staffId)
    .in("status", ["open", "in_progress"])
    .is("deleted_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as TaskRow[];
  const matterIds = Array.from(
    new Set(rows.map((r) => r.client_matter_id).filter(Boolean)),
  ) as string[];

  if (matterIds.length) {
    const { data: matters } = await supabase
      .schema("core")
      .from("client_matter")
      .select(
        "client_matter_id, matter_number, person:client_person_id(last_name, first_name)",
      )
      .in("client_matter_id", matterIds);
    const labels = new Map<string, string>();
    for (const m of matters ?? []) {
      const p = m.person as unknown as {
        last_name: string;
        first_name: string;
      } | null;
      labels.set(
        m.client_matter_id,
        p ? `${p.last_name}, ${p.first_name}` : (m.matter_number ?? "Matter"),
      );
    }
    for (const r of rows) {
      if (r.client_matter_id) r.matter_label = labels.get(r.client_matter_id);
    }
  }

  return rows;
}

export async function listCompanionMatters(
  incidentGroupId: string,
  excludeMatterId: string,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      "client_matter_id, matter_number, current_stage_code, person:client_person_id(first_name, last_name)",
    )
    .eq("incident_group_id", incidentGroupId)
    .neq("client_matter_id", excludeMatterId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (!rows.length) return [];

  const pairAllowed = new Map<string, boolean>();
  const { createServiceClient } = await import("@/lib/supabase/service");
  const admin = createServiceClient();
  if (admin) {
    const { data: links } = await admin
      .schema("core")
      .from("representation_link")
      .select("matter_a, matter_b, copy_sharing_allowed, conflict_status")
      .is("deleted_at", null)
      .or(
        `matter_a.eq.${excludeMatterId},matter_b.eq.${excludeMatterId}`,
      );

    for (const link of links ?? []) {
      const other =
        link.matter_a === excludeMatterId ? link.matter_b : link.matter_a;
      const ok =
        Boolean(link.copy_sharing_allowed) &&
        (link.conflict_status === "cleared" ||
          link.conflict_status === "waived_in_writing");
      pairAllowed.set(other as string, ok);
    }
  } else {
    for (const row of rows) {
      const { data: allowed } = await supabase.rpc("can_copy_notes_between", {
        p_a: excludeMatterId,
        p_b: row.client_matter_id,
      });
      pairAllowed.set(row.client_matter_id as string, Boolean(allowed));
    }
  }

  return rows.map((row) => ({
    ...row,
    copy_sharing_allowed: pairAllowed.get(row.client_matter_id as string) ?? false,
  }));
}

export async function listPinnedNotes(matterId: string) {
  const supabase = createClient();
  const { data: own, error } = await supabase
    .schema("workflow")
    .from("note")
    .select("note_id, body, pinned, created_at, scope")
    .eq("entity_id", matterId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return [];
  }

  const { data: targets } = await supabase
    .schema("workflow")
    .from("note_target")
    .select("note_id")
    .eq("client_matter_id", matterId)
    .is("deleted_at", null);

  const targetIds = (targets ?? [])
    .map((t) => t.note_id as string)
    .filter((id) => !(own ?? []).some((n) => n.note_id === id));

  let shared: {
    note_id: string;
    body: string;
    pinned: boolean;
    created_at: string;
    scope: string;
  }[] = [];

  if (targetIds.length) {
    const { data: sharedRows } = await supabase
      .schema("workflow")
      .from("note")
      .select("note_id, body, pinned, created_at, scope")
      .in("note_id", targetIds)
      .is("deleted_at", null);
    shared = (sharedRows ?? []) as typeof shared;
  }

  const merged = [...(own ?? []), ...shared.map((n) => ({ ...n, pinned: n.pinned }))];
  merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return merged.slice(0, 20);
}

export async function listTreatmentEpisodes(
  matterId: string,
): Promise<TreatmentEpisodeRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("medical")
    .from("treatment_episode")
    .select(
      `treatment_episode_id, status, is_primary_pm, under_lop, approx_balance,
       balance_as_of, first_visit_date, last_visit_date, provider_id`,
    )
    .eq("client_matter_id", matterId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return [];
  if (!data?.length) return [];

  const providerIds = Array.from(
    new Set(data.map((e) => e.provider_id as string).filter(Boolean)),
  );
  const { data: providers } = await supabase
    .schema("medical")
    .from("provider")
    .select("provider_id, provider_type, organization_id")
    .in("provider_id", providerIds);

  const orgIds = Array.from(
    new Set(
      (providers ?? [])
        .map((p) => p.organization_id as string)
        .filter(Boolean),
    ),
  );
  const { data: orgs } = orgIds.length
    ? await supabase
        .schema("core")
        .from("organization")
        .select("organization_id, name")
        .in("organization_id", orgIds)
    : { data: [] as { organization_id: string; name: string }[] };

  const orgName = new Map(
    (orgs ?? []).map((o) => [o.organization_id, o.name] as const),
  );
  const provMap = new Map(
    (providers ?? []).map((p) => [
      p.provider_id as string,
      {
        type: p.provider_type as string,
        name: orgName.get(p.organization_id as string) ?? null,
      },
    ]),
  );

  return data.map((e) => {
    const p = provMap.get(e.provider_id as string);
    return {
      treatment_episode_id: e.treatment_episode_id as string,
      status: e.status as string,
      is_primary_pm: Boolean(e.is_primary_pm),
      under_lop: Boolean(e.under_lop),
      approx_balance:
        e.approx_balance != null ? Number(e.approx_balance) : null,
      balance_as_of: (e.balance_as_of as string | null) ?? null,
      first_visit_date: (e.first_visit_date as string | null) ?? null,
      last_visit_date: (e.last_visit_date as string | null) ?? null,
      provider_id: e.provider_id as string,
      provider_name: p?.name ?? null,
      provider_type: p?.type ?? null,
    };
  });
}

export async function listProviderCallsDue(opts?: {
  staffId?: string;
  ownedOnly?: boolean;
}): Promise<ProviderCallDue[]> {
  const supabase = createClient();
  let q = supabase.schema("medical").from("v_provider_calls_due").select("*");
  if (opts?.ownedOnly && opts.staffId) {
    q = q.eq("owner_staff_id", opts.staffId);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    task_id: r.task_id as string,
    client_matter_id: r.client_matter_id as string,
    display_name: r.display_name as string,
    due_date: (r.due_date as string | null) ?? null,
    owner_staff_id: (r.owner_staff_id as string | null) ?? null,
    treatment_episode_id: r.treatment_episode_id as string,
    provider_name: r.provider_name as string,
    approx_balance:
      r.approx_balance != null ? Number(r.approx_balance) : null,
    balance_as_of: (r.balance_as_of as string | null) ?? null,
    episode_status: r.episode_status as string,
  }));
}

export async function listClaims(matterId: string): Promise<ClaimRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("insurance")
    .from("claim")
    .select(
      "claim_id, claim_number, claim_role, status, policy_id, lor_sent_date",
    )
    .eq("client_matter_id", matterId)
    .is("deleted_at", null);
  if (error) return [];
  return (data ?? []) as ClaimRow[];
}

/**
 * New cases for a CM: active assignment + sign-up checklist untouched
 * (no signup_checklist task done) and no completed welcome-call task.
 */
export async function listNewCasesQueue(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<NewCaseQueueRow[]> {
  const supabase = createClient();

  let assignQ = supabase
    .schema("core")
    .from("staff_assignment")
    .select("client_matter_id, assigned_at, staff_id")
    .eq("assignment_role", "case_manager")
    .is("ended_at", null);
  if (opts.assignedOnly) {
    assignQ = assignQ.eq("staff_id", opts.staffId);
  }

  const { data: assigns, error: aErr } = await assignQ;
  if (aErr) throw new Error(aErr.message);
  if (!assigns?.length) return [];

  const matterIds = assigns.map((a) => a.client_matter_id as string);
  const assignedAt = new Map(
    assigns.map((a) => [
      a.client_matter_id as string,
      a.assigned_at as string,
    ]),
  );

  const { data: tasks, error: tErr } = await supabase
    .schema("workflow")
    .from("task")
    .select("client_matter_id, title, status, task_type")
    .in("client_matter_id", matterIds)
    .is("deleted_at", null);
  if (tErr) throw new Error(tErr.message);

  const byMatter = new Map<
    string,
    { checklist: { title: string; status: string }[]; welcomeDone: boolean }
  >();
  for (const id of matterIds) {
    byMatter.set(id, { checklist: [], welcomeDone: false });
  }
  for (const t of tasks ?? []) {
    const mid = t.client_matter_id as string | null;
    if (!mid) continue;
    const slot = byMatter.get(mid);
    if (!slot) continue;
    const title = (t.title as string) ?? "";
    if (/welcome/i.test(title) && t.status === "done") {
      slot.welcomeDone = true;
    }
    if (t.task_type === "signup_checklist") {
      slot.checklist.push({ title, status: t.status as string });
    }
  }

  const newIds = matterIds.filter((id) => {
    const slot = byMatter.get(id)!;
    if (slot.welcomeDone) return false;
    const anyDone = slot.checklist.some((c) => c.status === "done");
    return !anyDone;
  });
  if (newIds.length === 0) return [];

  const { data: matters, error: mErr } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, matter_number, client_person_id,
       person:client_person_id(first_name, last_name),
       incident:incident_group_id(date_of_loss)`,
    )
    .in("client_matter_id", newIds)
    .is("deleted_at", null)
    .neq("representation_status", "declined");
  if (mErr) throw new Error(mErr.message);

  const rows: NewCaseQueueRow[] = (matters ?? []).map((m) => {
    const person = m.person as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const incident = m.incident as unknown as {
      date_of_loss: string | null;
    } | null;
    const assigned = assignedAt.get(m.client_matter_id) ?? new Date().toISOString();
    const slot = byMatter.get(m.client_matter_id)!;
    const outstanding =
      slot.checklist.length > 0
        ? slot.checklist
            .filter((c) => c.status !== "done" && c.status !== "cancelled")
            .map((c) => c.title)
        : ["Sign-up checklist not generated yet"];
    return {
      client_matter_id: m.client_matter_id,
      display_name: person
        ? `${person.last_name}, ${person.first_name}`
        : (m.matter_number ?? "Matter"),
      matter_number: m.matter_number,
      date_of_loss: incident?.date_of_loss ?? null,
      assigned_at: assigned,
      days_since_assignment: daysBetween(assigned),
      outstanding,
    };
  });

  rows.sort(
    (a, b) =>
      b.days_since_assignment - a.days_since_assignment ||
      a.display_name.localeCompare(b.display_name),
  );
  return rows;
}

/** Incomplete Send-LOR checklist tasks for the CM's matters. */
export async function listLorPendingQueue(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<LorPendingQueueRow[]> {
  const supabase = createClient();

  let matterIds: string[] | null = null;
  if (opts.assignedOnly) {
    const { data: assigns, error: aErr } = await supabase
      .schema("core")
      .from("staff_assignment")
      .select("client_matter_id")
      .eq("staff_id", opts.staffId)
      .eq("assignment_role", "case_manager")
      .is("ended_at", null);
    if (aErr) throw new Error(aErr.message);
    matterIds = (assigns ?? []).map((a) => a.client_matter_id as string);
    if (matterIds.length === 0) return [];
  }

  let taskQ = supabase
    .schema("workflow")
    .from("task")
    .select(
      "task_id, client_matter_id, title, due_date, created_at, status, task_type",
    )
    .in("status", ["open", "in_progress"])
    .eq("task_type", "signup_checklist")
    .is("deleted_at", null);
  if (matterIds) taskQ = taskQ.in("client_matter_id", matterIds);

  const { data: tasks, error: tErr } = await taskQ;
  if (tErr) throw new Error(tErr.message);

  const lorTasks = (tasks ?? []).filter((t) =>
    isLorTaskTitle((t.title as string) ?? ""),
  );
  if (lorTasks.length === 0) return [];

  const ids = Array.from(
    new Set(
      lorTasks
        .map((t) => t.client_matter_id as string | null)
        .filter(Boolean) as string[],
    ),
  );

  const { data: matters, error: mErr } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, matter_number,
       person:client_person_id(first_name, last_name),
       incident:incident_group_id(date_of_loss)`,
    )
    .in("client_matter_id", ids)
    .is("deleted_at", null);
  if (mErr) throw new Error(mErr.message);

  const matterMap = new Map(
    (matters ?? []).map((m) => [m.client_matter_id as string, m] as const),
  );

  const { data: claims } = await supabase
    .schema("insurance")
    .from("claim")
    .select("claim_id, client_matter_id, claim_role, claim_number, lor_sent_date")
    .in("client_matter_id", ids)
    .is("deleted_at", null);

  const claimsByMatter = new Map<
    string,
    {
      claim_id: string;
      claim_role: string;
      claim_number: string | null;
      lor_sent_date: string | null;
    }[]
  >();
  for (const c of claims ?? []) {
    const mid = c.client_matter_id as string | null;
    if (!mid) continue;
    const list = claimsByMatter.get(mid) ?? [];
    list.push({
      claim_id: c.claim_id as string,
      claim_role: c.claim_role as string,
      claim_number: (c.claim_number as string | null) ?? null,
      lor_sent_date: (c.lor_sent_date as string | null) ?? null,
    });
    claimsByMatter.set(mid, list);
  }

  const rows: LorPendingQueueRow[] = [];
  for (const t of lorTasks) {
    const mid = t.client_matter_id as string | null;
    if (!mid) continue;
    const m = matterMap.get(mid);
    if (!m) continue;

    const title = (t.title as string) ?? "";
    const roles = claimRolesForLorTitle(title);
    const matterClaims = claimsByMatter.get(mid) ?? [];
    const matched =
      matterClaims.find(
        (c) =>
          roles.includes(c.claim_role) && c.lor_sent_date == null,
      ) ??
      matterClaims.find((c) => roles.includes(c.claim_role)) ??
      null;

    // If matching claim already has lor_sent_date, trigger should have
    // completed the task — still hide if sent date is set.
    if (matched?.lor_sent_date) continue;

    const person = m.person as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const incident = m.incident as unknown as {
      date_of_loss: string | null;
    } | null;
    const anchor =
      (t.created_at as string | null) ??
      (t.due_date as string | null) ??
      new Date().toISOString();

    rows.push({
      task_id: t.task_id as string,
      client_matter_id: mid,
      display_name: person
        ? `${person.last_name}, ${person.first_name}`
        : ((m.matter_number as string | null) ?? "Matter"),
      matter_number: (m.matter_number as string | null) ?? null,
      date_of_loss: incident?.date_of_loss ?? null,
      task_title: title,
      claim_role: matched?.claim_role ?? null,
      claim_number: matched?.claim_number ?? null,
      claim_id: matched?.claim_id ?? null,
      days_pending: daysBetween(anchor),
      due_date: (t.due_date as string | null) ?? null,
    });
  }

  rows.sort(
    (a, b) =>
      b.days_pending - a.days_pending ||
      a.display_name.localeCompare(b.display_name),
  );
  return rows;
}

/** Claims still awaiting a liability decision (status = open). */
export async function listLiabilityPendingQueue(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<LiabilityPendingQueueRow[]> {
  const labels = await loadCmMatterLabels(opts);
  if (labels.length === 0) return [];

  const supabase = createClient();
  const byMatter = new Map(labels.map((m) => [m.client_matter_id, m]));
  const byIncident = new Map<string, MatterLabel[]>();
  for (const m of labels) {
    const list = byIncident.get(m.incident_group_id) ?? [];
    list.push(m);
    byIncident.set(m.incident_group_id, list);
  }

  const matterIds = labels.map((m) => m.client_matter_id);
  const incidentIds = Array.from(byIncident.keys());

  const { data: matterClaims, error: mcErr } = await supabase
    .schema("insurance")
    .from("claim")
    .select(
      "claim_id, client_matter_id, incident_group_id, claim_role, claim_number, status, created_at, reported_date",
    )
    .in("client_matter_id", matterIds)
    .in("claim_role", [...LIABILITY_CLAIM_ROLES])
    .eq("status", "open")
    .is("deleted_at", null);
  if (mcErr) throw new Error(mcErr.message);

  const { data: incidentClaims, error: icErr } = incidentIds.length
    ? await supabase
        .schema("insurance")
        .from("claim")
        .select(
          "claim_id, client_matter_id, incident_group_id, claim_role, claim_number, status, created_at, reported_date",
        )
        .in("incident_group_id", incidentIds)
        .in("claim_role", [...LIABILITY_CLAIM_ROLES])
        .eq("status", "open")
        .is("deleted_at", null)
    : { data: [] as Record<string, unknown>[], error: null };
  if (icErr) throw new Error(icErr.message);

  const seen = new Set<string>();
  const rows: LiabilityPendingQueueRow[] = [];

  function pushClaim(c: {
    claim_id: string;
    client_matter_id: string | null;
    incident_group_id: string | null;
    claim_role: string;
    claim_number: string | null;
    status: string;
    created_at: string | null;
    reported_date: string | null;
  }) {
    if (seen.has(c.claim_id)) return;
    seen.add(c.claim_id);

    let matter: MatterLabel | undefined;
    if (c.client_matter_id) {
      matter = byMatter.get(c.client_matter_id);
    } else if (c.incident_group_id) {
      matter = byIncident.get(c.incident_group_id)?.[0];
    }
    if (!matter) return;

    const anchor =
      c.reported_date ?? c.created_at ?? new Date().toISOString();
    rows.push({
      claim_id: c.claim_id,
      client_matter_id: matter.client_matter_id,
      display_name: matter.display_name,
      matter_number: matter.matter_number,
      date_of_loss: matter.date_of_loss,
      claim_role: c.claim_role,
      claim_number: c.claim_number,
      claim_status: c.status,
      days_pending: daysBetween(anchor),
    });
  }

  for (const c of matterClaims ?? []) {
    pushClaim({
      claim_id: c.claim_id as string,
      client_matter_id: (c.client_matter_id as string | null) ?? null,
      incident_group_id: (c.incident_group_id as string | null) ?? null,
      claim_role: c.claim_role as string,
      claim_number: (c.claim_number as string | null) ?? null,
      status: c.status as string,
      created_at: (c.created_at as string | null) ?? null,
      reported_date: (c.reported_date as string | null) ?? null,
    });
  }
  for (const c of incidentClaims ?? []) {
    pushClaim({
      claim_id: c.claim_id as string,
      client_matter_id: (c.client_matter_id as string | null) ?? null,
      incident_group_id: (c.incident_group_id as string | null) ?? null,
      claim_role: c.claim_role as string,
      claim_number: (c.claim_number as string | null) ?? null,
      status: c.status as string,
      created_at: (c.created_at as string | null) ?? null,
      reported_date: (c.reported_date as string | null) ?? null,
    });
  }

  rows.sort(
    (a, b) =>
      b.days_pending - a.days_pending ||
      a.display_name.localeCompare(b.display_name),
  );
  return rows;
}

/** Unresolved PD claims on incidents for the CM's matters. */
export async function listPdPendingQueue(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<PdPendingQueueRow[]> {
  const labels = await loadCmMatterLabels(opts);
  if (labels.length === 0) return [];

  const supabase = createClient();
  const byIncident = new Map<string, MatterLabel[]>();
  for (const m of labels) {
    const list = byIncident.get(m.incident_group_id) ?? [];
    list.push(m);
    byIncident.set(m.incident_group_id, list);
  }
  const incidentIds = Array.from(byIncident.keys());

  const { data: aging, error } = await supabase
    .schema("property")
    .from("v_pd_aging")
    .select(
      `pd_claim_id, incident_group_id, year, make, model, status,
       last_touch_date, days_since_touch, demand_blocker`,
    )
    .in("incident_group_id", incidentIds);
  if (error) throw new Error(error.message);
  if (!aging?.length) return [];

  const rows: PdPendingQueueRow[] = [];
  for (const p of aging) {
    const ig = p.incident_group_id as string;
    const matter = byIncident.get(ig)?.[0];
    if (!matter) continue;
    const vehicle_label =
      [p.year, p.make, p.model].filter(Boolean).join(" ") || "Vehicle";
    rows.push({
      pd_claim_id: p.pd_claim_id as string,
      client_matter_id: matter.client_matter_id,
      display_name: matter.display_name,
      matter_number: matter.matter_number,
      date_of_loss: matter.date_of_loss,
      vehicle_label,
      status: p.status as string,
      days_since_touch:
        p.days_since_touch != null ? Number(p.days_since_touch) : null,
      demand_blocker: Boolean(p.demand_blocker),
    });
  }

  rows.sort(
    (a, b) =>
      (b.days_since_touch ?? -1) - (a.days_since_touch ?? -1) ||
      a.display_name.localeCompare(b.display_name),
  );
  return rows;
}

/** Outstanding records/bills requests across the CM caseload. */
export async function listRecordsPendingQueue(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<RecordsPendingQueueRow[]> {
  const labels = await loadCmMatterLabels(opts);
  if (labels.length === 0) return [];

  const supabase = createClient();
  const byMatter = new Map(labels.map((m) => [m.client_matter_id, m]));
  const matterIds = labels.map((m) => m.client_matter_id);

  const { data: episodes, error: eErr } = await supabase
    .schema("medical")
    .from("treatment_episode")
    .select("treatment_episode_id, client_matter_id, provider_id")
    .in("client_matter_id", matterIds)
    .is("deleted_at", null);
  if (eErr) throw new Error(eErr.message);
  if (!episodes?.length) return [];

  const epToMatter = new Map(
    episodes.map((e) => [
      e.treatment_episode_id as string,
      e.client_matter_id as string,
    ]),
  );
  const epIds = episodes.map((e) => e.treatment_episode_id as string);
  const providerIds = Array.from(
    new Set(episodes.map((e) => e.provider_id as string).filter(Boolean)),
  );

  const { data: providers } = providerIds.length
    ? await supabase
        .schema("medical")
        .from("provider")
        .select("provider_id, organization_id")
        .in("provider_id", providerIds)
    : { data: [] as { provider_id: string; organization_id: string }[] };

  const orgIds = Array.from(
    new Set(
      (providers ?? [])
        .map((p) => p.organization_id as string)
        .filter(Boolean),
    ),
  );
  const { data: orgs } = orgIds.length
    ? await supabase
        .schema("core")
        .from("organization")
        .select("organization_id, name")
        .in("organization_id", orgIds)
    : { data: [] as { organization_id: string; name: string }[] };

  const orgName = new Map(
    (orgs ?? []).map((o) => [o.organization_id, o.name] as const),
  );
  const providerName = new Map(
    (providers ?? []).map((p) => [
      p.provider_id as string,
      orgName.get(p.organization_id as string) ?? null,
    ]),
  );
  const epProvider = new Map(
    episodes.map((e) => [
      e.treatment_episode_id as string,
      providerName.get(e.provider_id as string) ?? null,
    ]),
  );

  const { data: reqs, error: rErr } = await supabase
    .schema("medical")
    .from("record_request")
    .select(
      `record_request_id, treatment_episode_id, request_type, status,
       sent_date, follow_up_due, created_at`,
    )
    .in("treatment_episode_id", epIds)
    .not("status", "in", "(received,cancelled)");
  if (rErr) throw new Error(rErr.message);

  const rows: RecordsPendingQueueRow[] = [];
  for (const r of reqs ?? []) {
    const mid = epToMatter.get(r.treatment_episode_id as string);
    if (!mid) continue;
    const matter = byMatter.get(mid);
    if (!matter) continue;
    const anchor =
      (r.sent_date as string | null) ??
      (r.created_at as string | null) ??
      new Date().toISOString();
    rows.push({
      record_request_id: r.record_request_id as string,
      client_matter_id: mid,
      display_name: matter.display_name,
      matter_number: matter.matter_number,
      date_of_loss: matter.date_of_loss,
      provider_name: epProvider.get(r.treatment_episode_id as string) ?? null,
      request_type: r.request_type as string,
      status: r.status as string,
      sent_date: (r.sent_date as string | null) ?? null,
      follow_up_due: (r.follow_up_due as string | null) ?? null,
      days_pending: daysBetween(anchor),
    });
  }

  rows.sort(
    (a, b) =>
      b.days_pending - a.days_pending ||
      a.display_name.localeCompare(b.display_name),
  );
  return rows;
}

export async function countCmWorkQueues(opts: {
  staffId: string;
  assignedOnly?: boolean;
}): Promise<CmQueueCounts> {
  const [newCases, lors, liability, pd, records] = await Promise.all([
    listNewCasesQueue(opts),
    listLorPendingQueue(opts),
    listLiabilityPendingQueue(opts),
    listPdPendingQueue(opts),
    listRecordsPendingQueue(opts),
  ]);
  return {
    newCases: newCases.length,
    lors: lors.length,
    liability: liability.length,
    pd: pd.length,
    records: records.length,
  };
}
