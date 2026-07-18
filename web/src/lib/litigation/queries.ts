import { createClient } from "@/lib/supabase/server";
import type { HorizonRow, LitCaseloadRow, CourtCaseRow } from "./types";
import type { TaskRow } from "@/lib/cases/types";
import {
  getMatter,
  getMatterTeam,
  getPersonContacts,
  listMatterTasks,
  listPinnedNotes,
} from "@/lib/cases/queries";

export {
  getMatter,
  getMatterTeam,
  getPersonContacts,
  listMatterTasks,
  listPinnedNotes,
};

export async function listLitigationCaseload(opts?: {
  staffId?: string;
  assignedOnly?: boolean;
}): Promise<LitCaseloadRow[]> {
  const supabase = createClient();

  let matterIds: string[] | null = null;
  if (opts?.assignedOnly && opts.staffId) {
    const { data: assigns, error } = await supabase
      .schema("core")
      .from("staff_assignment")
      .select("client_matter_id")
      .eq("staff_id", opts.staffId)
      .eq("assignment_role", "litigation_paralegal")
      .is("ended_at", null)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    matterIds = (assigns ?? []).map((a) => a.client_matter_id);
    if (matterIds.length === 0) return [];
  }

  let mq = supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, matter_number, current_stage_code, sol_date,
       person:client_person_id(first_name, last_name, preferred_language),
       incident:incident_group_id(case_type_code)`,
    )
    .is("deleted_at", null)
    .eq("representation_status", "active")
    .neq("current_stage_code", "closed");

  if (matterIds) {
    mq = mq.in("client_matter_id", matterIds);
  } else {
    // Attorneys/admins: litigation-stage matters (demo focus)
    mq = mq.eq("current_stage_code", "litigation");
  }

  const { data: matters, error: mErr } = await mq;
  if (mErr) throw new Error(mErr.message);
  if (!matters?.length) return [];

  const ids = matters.map((m) => m.client_matter_id);

  const [{ data: courts }, { data: assigns }, { data: deadlines }] =
    await Promise.all([
      supabase
        .schema("litigation")
        .from("court_case")
        .select(
          "client_matter_id, cause_number, filed_date, discovery_level, court:court_id(name)",
        )
        .in("client_matter_id", ids)
        .is("deleted_at", null),
      supabase
        .schema("core")
        .from("staff_assignment")
        .select(
          `client_matter_id, assignment_role,
           staff:staff_id(email, person:person_id(first_name, last_name))`,
        )
        .in("client_matter_id", ids)
        .is("ended_at", null)
        .is("deleted_at", null),
      supabase
        .schema("workflow")
        .from("deadline")
        .select("client_matter_id, label, effective_date, jurisdictional, status")
        .in("client_matter_id", ids)
        .eq("status", "pending")
        .order("effective_date", { ascending: true }),
    ]);

  type CourtJoin = {
    client_matter_id: string;
    cause_number: string | null;
    filed_date: string | null;
    discovery_level: number | null;
    court: { name: string } | { name: string }[] | null;
  };
  const courtByMatter = new Map<string, CourtJoin>();
  for (const c of (courts ?? []) as CourtJoin[]) {
    courtByMatter.set(c.client_matter_id, c);
  }

  const teamByMatter = new Map<string, { cm?: string; pl?: string }>();
  for (const a of assigns ?? []) {
    const staff = a.staff as unknown as {
      email?: string;
      person?: { first_name: string; last_name: string } | null;
    } | null;
    const name = staff?.person
      ? `${staff.person.first_name} ${staff.person.last_name}`
      : staff?.email;
    const slot = teamByMatter.get(a.client_matter_id) ?? {};
    if (a.assignment_role === "case_manager") slot.cm = name ?? undefined;
    if (a.assignment_role === "litigation_paralegal") slot.pl = name ?? undefined;
    teamByMatter.set(a.client_matter_id, slot);
  }

  const nextByMatter = new Map<
    string,
    { label: string; date: string; jx: boolean }
  >();
  for (const d of deadlines ?? []) {
    if (!d.client_matter_id || nextByMatter.has(d.client_matter_id)) continue;
    nextByMatter.set(d.client_matter_id, {
      label: d.label,
      date: d.effective_date,
      jx: !!d.jurisdictional,
    });
  }

  return matters.map((m) => {
    const person = m.person as unknown as {
      first_name: string;
      last_name: string;
      preferred_language: string;
    } | null;
    const incident = m.incident as unknown as { case_type_code: string } | null;
    const court = courtByMatter.get(m.client_matter_id);
    const courtRel = court?.court;
    const courtName = Array.isArray(courtRel)
      ? courtRel[0]?.name
      : courtRel?.name;
    const team = teamByMatter.get(m.client_matter_id);
    const next = nextByMatter.get(m.client_matter_id);

    return {
      client_matter_id: m.client_matter_id,
      display_name: person
        ? `${person.last_name}, ${person.first_name}`
        : (m.matter_number ?? "Matter"),
      matter_number: m.matter_number,
      current_stage_code: m.current_stage_code,
      sol_date: m.sol_date,
      cause_number: court?.cause_number ?? null,
      court_name: courtName ?? null,
      filed_date: court?.filed_date ?? null,
      discovery_level: court?.discovery_level ?? null,
      next_deadline_label: next?.label ?? null,
      next_deadline_date: next?.date ?? null,
      next_deadline_jx: next?.jx ?? false,
      cm_name: team?.cm ?? null,
      pl_name: team?.pl ?? null,
      preferred_language: person?.preferred_language ?? null,
      case_type_code: incident?.case_type_code ?? null,
    };
  });
}

export async function listDeadlineHorizon(opts?: {
  staffId?: string;
  assignedOnly?: boolean;
}): Promise<HorizonRow[]> {
  const supabase = createClient();

  let matterIds: string[] | null = null;
  if (opts?.assignedOnly && opts.staffId) {
    const { data: assigns } = await supabase
      .schema("core")
      .from("staff_assignment")
      .select("client_matter_id")
      .eq("staff_id", opts.staffId)
      .eq("assignment_role", "litigation_paralegal")
      .is("ended_at", null)
      .is("deleted_at", null);
    matterIds = (assigns ?? []).map((a) => a.client_matter_id);
    if (matterIds.length === 0) return [];
  }

  const { data, error } = await supabase
    .schema("litigation")
    .from("v_deadline_horizon")
    .select("*");
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as HorizonRow[];
  if (matterIds) {
    const set = new Set(matterIds);
    rows = rows.filter(
      (r) => r.client_matter_id && set.has(r.client_matter_id),
    );
  }

  // Enrich source from deadline table
  const ids = rows.map((r) => r.deadline_id);
  if (ids.length) {
    const { data: full } = await supabase
      .schema("workflow")
      .from("deadline")
      .select("deadline_id, source")
      .in("deadline_id", ids);
    const src = new Map((full ?? []).map((d) => [d.deadline_id, d.source]));
    for (const r of rows) r.source = src.get(r.deadline_id) ?? null;
  }

  // Overdue first, then by date
  const today = new Date().toISOString().slice(0, 10);
  return rows.sort((a, b) => {
    const aOver = a.effective_date < today ? 0 : 1;
    const bOver = b.effective_date < today ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return a.effective_date.localeCompare(b.effective_date);
  });
}

export async function listMatterDeadlines(matterId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("workflow")
    .from("deadline")
    .select(
      "deadline_id, label, effective_date, jurisdictional, source, status, rule_code",
    )
    .eq("client_matter_id", matterId)
    .in("status", ["pending", "missed"])
    .order("effective_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCourtCase(
  matterId: string,
): Promise<CourtCaseRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("litigation")
    .from("court_case")
    .select(
      "court_case_id, cause_number, filed_date, discovery_level, dco_signed_date, jury_demanded, hb19_applies, status, court:court_id(name)",
    )
    .eq("client_matter_id", matterId)
    .is("deleted_at", null)
    .order("filed_date", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const court = data.court as unknown as { name: string } | null;
  return {
    court_case_id: data.court_case_id,
    cause_number: data.cause_number,
    filed_date: data.filed_date,
    discovery_level: data.discovery_level,
    dco_signed_date: data.dco_signed_date,
    jury_demanded: data.jury_demanded,
    hb19_applies: data.hb19_applies,
    status: data.status,
    court_name: court?.name ?? null,
  };
}

export async function listMyLitTasks(staffId: string): Promise<TaskRow[]> {
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
    .limit(150);
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
