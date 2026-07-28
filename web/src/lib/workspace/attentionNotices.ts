import type {
  AttentionNoticeCard,
  AttentionNoticeTone,
} from "@/components/workspace/RoleAttentionNotices";
import {
  needsAttention,
  type CaseloadRow,
} from "@/lib/cases/types";
import type { LeadRow } from "@/lib/intake/types";
import { leadDisplayName } from "@/lib/intake/display";
import { gateFromLead } from "@/lib/intake/gate";
import type { LitCaseloadRow } from "@/lib/litigation/types";
import type {
  DemandReadinessRow,
  LienWorklistRow,
} from "@/lib/phase7/queries";

type Issue = {
  category: string;
  tone: AttentionNoticeTone;
  title: string;
  label: string;
};

function cmPrimaryIssue(
  row: CaseloadRow & { open_checklist?: number },
): Issue | null {
  if (row.flag_sol_within_120d) {
    return {
      category: "Jurisdictional",
      tone: "crit",
      title: "Filing deadline",
      label: "filing deadline < 120 days",
    };
  }
  if (row.flag_provider_check_overdue) {
    return {
      category: "Watch",
      tone: "warn",
      title: "Provider call overdue",
      label: "provider call overdue",
    };
  }
  if (row.flag_pd_unresolved) {
    return {
      category: "Watch",
      tone: "warn",
      title: "Property damage open",
      label: "PD unresolved",
    };
  }
  if (row.flag_records_not_ordered) {
    return {
      category: "Watch",
      tone: "warn",
      title: "Records aging",
      label: "records not ordered",
    };
  }
  if (row.flag_demand_response_overdue) {
    return {
      category: "Watch",
      tone: "warn",
      title: "Demand response late",
      label: "demand response overdue",
    };
  }
  if (row.flag_no_client_contact_30d) {
    return {
      category: "Client contact",
      tone: "info",
      title: "Client contact gap",
      label: "no client contact in 30 days",
    };
  }
  if (row.flag_treatment_compliance) {
    return {
      category: "Watch",
      tone: "warn",
      title: "Treatment concern",
      label: "treatment compliance flag",
    };
  }
  if (row.flag_missing_level) {
    return {
      category: "Approval",
      tone: "crit",
      title: "Level missing",
      label: "missing case Level — escalate to attorney",
    };
  }
  if ((row.open_checklist ?? 0) > 0) {
    return {
      category: "Checklist",
      tone: "info",
      title: "Open checklist work",
      label: `${row.open_checklist} open checklist item${row.open_checklist === 1 ? "" : "s"}`,
    };
  }
  if (needsAttention(row)) {
    return {
      category: "Watch",
      tone: "info",
      title: "Needs attention",
      label: "flagged on your caseload",
    };
  }
  return null;
}

/** Top 3 story cards for Case Manager (assigned caseload only). */
export function cmAttentionCards(
  rows: CaseloadRow[],
  hrefBase = "/cases",
): AttentionNoticeCard[] {
  const ranked = rows
    .map((r) => ({ row: r, issue: cmPrimaryIssue(r) }))
    .filter((x): x is { row: CaseloadRow; issue: Issue } => x.issue != null)
    .sort((a, b) => {
      const rank = (t: AttentionNoticeTone) =>
        t === "crit" ? 0 : t === "warn" ? 1 : 2;
      return rank(a.issue.tone) - rank(b.issue.tone);
    })
    .slice(0, 3);

  return ranked.map(({ row, issue }) => ({
    key: row.client_matter_id,
    category: issue.category.toUpperCase(),
    tone: issue.tone,
    title: issue.title,
    body: `${row.display_name} · ${issue.label}.`,
    meta:
      row.case_age_days != null
        ? `${row.case_age_days}d on file`
        : "Assigned to you",
    href: `${hrefBase}/${row.client_matter_id}`,
  }));
}

export function litAttentionCards(
  rows: LitCaseloadRow[],
): AttentionNoticeCard[] {
  const today = new Date().toISOString().slice(0, 10);
  const cards: AttentionNoticeCard[] = [];

  for (const r of rows) {
    if (cards.length >= 3) break;
    const jxDue =
      r.next_deadline_jx &&
      r.next_deadline_date &&
      r.next_deadline_date <= today;
    if (jxDue) {
      cards.push({
        key: `${r.client_matter_id}-jx`,
        category: "JURISDICTIONAL",
        tone: "crit",
        title: "Deadline due",
        body: `${r.display_name} · ${r.next_deadline_label ?? "jurisdictional deadline"} due.`,
        meta: r.cause_number ?? "No cause number",
        href: `/litigation/${r.client_matter_id}`,
      });
      continue;
    }
    if (!r.cause_number) {
      cards.push({
        key: `${r.client_matter_id}-cause`,
        category: "FILING",
        tone: "warn",
        title: "Missing cause number",
        body: `${r.display_name} · filed case needs cause / court entry.`,
        meta: r.pl_name ? `PL: ${r.pl_name}` : "PL unassigned",
        href: `/litigation/${r.client_matter_id}`,
      });
      continue;
    }
    if (!r.pl_name) {
      cards.push({
        key: `${r.client_matter_id}-pl`,
        category: "ASSIGNMENT",
        tone: "warn",
        title: "PL unassigned",
        body: `${r.display_name} · litigation paralegal not assigned.`,
        meta: r.cause_number,
        href: `/litigation/${r.client_matter_id}`,
      });
    }
  }

  return cards.slice(0, 3);
}

export function intakeAttentionCards(leads: LeadRow[]): AttentionNoticeCard[] {
  const cards: AttentionNoticeCard[] = [];

  const nel = leads.filter(
    (l) => l.status === "rejected" && !l.non_engagement_letter_sent_date,
  );
  for (const l of nel) {
    if (cards.length >= 3) break;
    cards.push({
      key: `nel-${l.intake_lead_id}`,
      category: "MALPRACTICE",
      tone: "crit",
      title: "Non-engagement letter due",
      body: `${leadDisplayName(l)} · rejected without NEL sent.`,
      meta: "Same-day control",
      href: `/intake/leads/${l.intake_lead_id}`,
    });
  }

  const contractOut = leads.filter((l) => l.status === "contract_sent");
  for (const l of contractOut) {
    if (cards.length >= 3) break;
    cards.push({
      key: `contract-${l.intake_lead_id}`,
      category: "CONTRACT",
      tone: "warn",
      title: "Contract outstanding",
      body: `${leadDisplayName(l)} · contract sent — chase signature.`,
      meta: l.lead_temperature
        ? `Temp: ${l.lead_temperature}`
        : "Contract out",
      href: `/intake/leads/${l.intake_lead_id}`,
    });
  }

  const openIncomplete = leads.filter((l) => {
    if (l.status !== "open") return false;
    const g = gateFromLead(l, {
      phone: l.primary_phone ?? l.raw_phone,
      email: l.primary_email ?? l.raw_email,
    });
    return !g.ready;
  });
  for (const l of openIncomplete) {
    if (cards.length >= 3) break;
    const g = gateFromLead(l, {
      phone: l.primary_phone ?? l.raw_phone,
      email: l.primary_email ?? l.raw_email,
    });
    const firstGap = g.missing[0];
    cards.push({
      key: `gate-${l.intake_lead_id}`,
      category: "INTAKE",
      tone: "info",
      title: "Six-minimums incomplete",
      body: `${leadDisplayName(l)} · ${firstGap?.label ?? "finish gate before contract"}.`,
      meta: "Open lead",
      href: `/intake/leads/${l.intake_lead_id}`,
    });
  }

  return cards.slice(0, 3);
}

export function demandAttentionCards(
  rows: DemandReadinessRow[],
): AttentionNoticeCard[] {
  const cards: AttentionNoticeCard[] = [];

  for (const r of rows) {
    if (cards.length >= 3) break;
    const name = r.display_name ?? "Matter";
    const href = `/cases/${r.client_matter_id}?mode=readonly`;

    if (
      r.needs_attorney_approval &&
      !r.attorney_approved &&
      r.kate_reviewed
    ) {
      cards.push({
        key: `${r.client_matter_id}-atty`,
        category: "APPROVAL",
        tone: "crit",
        title: "Attorney approval needed",
        body: `${name} · Level 3 / owner sign-off before send.`,
        meta: "Read-only matter",
        href,
      });
      continue;
    }
    if ((r.records_outstanding ?? 0) > 0 || !r.pd_clear) {
      cards.push({
        key: `${r.client_matter_id}-block`,
        category: "BLOCKER",
        tone: "warn",
        title: "Package blocker",
        body: `${name} · ${!r.pd_clear ? "PD not clear" : `${r.records_outstanding} records out`} — flag CM, don’t draft around.`,
        meta: r.treatment_complete ? "Treatment complete" : "Treatment open",
        href,
      });
      continue;
    }
    if (!r.kate_reviewed && r.demand_id) {
      cards.push({
        key: `${r.client_matter_id}-review`,
        category: "DEMAND",
        tone: "info",
        title: "Awaiting Kate review",
        body: `${name} · draft in queue — quality-gate then send.`,
        meta:
          r.approved_level != null ? `L${r.approved_level}` : "Level unset",
        href,
      });
    }
  }

  return cards.slice(0, 3);
}

export function lienAttentionCards(
  rows: LienWorklistRow[],
): AttentionNoticeCard[] {
  const cards: AttentionNoticeCard[] = [];

  for (const r of rows) {
    if (cards.length >= 3) break;
    const name = r.display_name ?? "Matter";
    const href = `/cases/${r.client_matter_id}?mode=readonly`;

    if (r.matter_settled && r.status !== "paid" && r.status !== "waived") {
      cards.push({
        key: `${r.lien_id}-settle`,
        category: "DISBURSEMENT",
        tone: "crit",
        title: "Settled — lien open",
        body: `${name} · ${r.lien_type ?? "lien"} (${r.holder ?? "holder"}) still open after settlement.`,
        meta: r.status,
        href,
      });
      continue;
    }
    if (r.flagged_for_resolution_date) {
      cards.push({
        key: `${r.lien_id}-flag`,
        category: "LIEN",
        tone: "warn",
        title: "Flagged for resolution",
        body: `${name} · ${r.holder ?? r.lien_type ?? "lien"} needs negotiate / payoff.`,
        meta: r.status,
        href,
      });
      continue;
    }
    if (r.status === "asserted" || r.status === "pending") {
      cards.push({
        key: `${r.lien_id}-assert`,
        category: "LIEN",
        tone: "info",
        title: "Lien to verify",
        body: `${name} · ${r.holder ?? "holder"} · ${r.status}.`,
        meta: r.lien_type ?? "Lien",
        href,
      });
    }
  }

  return cards.slice(0, 3);
}
