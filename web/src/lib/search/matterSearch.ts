import { formatDate } from "@/lib/dates";

export type MatterSearchHit = {
  client_matter_id: string;
  label: string;
  sub: string;
  href: string;
  stage: string;
};

/** Split search into name parts ("Bill", "Brown, Bill" → tokens). */
export function searchTermParts(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const cleaned = t.replace(/[%,]/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  return parts.length ? parts : [cleaned];
}

/** Michael: search / firm attention open Case Manager matter view by default. */
export function matterSearchHref(matterId: string): string {
  return `/cases/${matterId}`;
}

type MatterRow = {
  client_matter_id: string;
  current_stage_code: string;
  matter_number: string | null;
  person: { first_name: string; last_name: string } | null;
  incident: { date_of_loss: string | null } | null;
};

type PersonRow = {
  person_id: string;
  first_name: string;
  last_name: string;
};

// Minimal query client shape (browser or server Supabase client)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { schema: (s: string) => any };

/**
 * Case-first search: match people by first/last substring,
 * return their matters (client + DOI → /cases/[id]).
 */
export async function searchMattersByQuery(
  supabase: AnyClient,
  q: string,
  limit = 12,
): Promise<MatterSearchHit[]> {
  const term = q.trim();
  if (!term) return [];

  const parts = searchTermParts(term);
  const primary = parts[0] ?? term;
  const orClause = parts
    .flatMap((p) => [`first_name.ilike.%${p}%`, `last_name.ilike.%${p}%`])
    .join(",");

  const { data: people, error: pErr } = await supabase
    .schema("core")
    .from("person")
    .select("person_id, first_name, last_name")
    .or(orClause)
    .is("deleted_at", null)
    .limit(40);
  if (pErr) throw new Error(pErr.message);

  const personIds = ((people ?? []) as PersonRow[]).map((p) => p.person_id);

  const matterSelect = `
    client_matter_id, current_stage_code, matter_number,
    person:client_person_id(first_name, last_name),
    incident:incident_group_id(date_of_loss)
  `;

  let matters: MatterRow[] = [];

  if (personIds.length > 0) {
    const { data, error } = await supabase
      .schema("core")
      .from("client_matter")
      .select(matterSelect)
      .in("client_person_id", personIds)
      .is("deleted_at", null)
      .limit(limit * 2);
    if (error) throw new Error(error.message);
    matters = (data ?? []) as unknown as MatterRow[];
  }

  if (matters.length < limit) {
    const { data: byNum, error: nErr } = await supabase
      .schema("core")
      .from("client_matter")
      .select(matterSelect)
      .ilike("matter_number", `%${primary}%`)
      .is("deleted_at", null)
      .limit(limit);
    if (!nErr && byNum) {
      const seen = new Set(matters.map((m) => m.client_matter_id));
      for (const row of byNum as unknown as MatterRow[]) {
        if (!seen.has(row.client_matter_id)) {
          matters.push(row);
          seen.add(row.client_matter_id);
        }
      }
    }
  }

  if (parts.length >= 2) {
    const [a, b] = parts;
    const ranked = matters.filter((m) => {
      const fn = (m.person?.first_name ?? "").toLowerCase();
      const ln = (m.person?.last_name ?? "").toLowerCase();
      const al = a!.toLowerCase();
      const bl = b!.toLowerCase();
      return (
        (fn.includes(al) && ln.includes(bl)) ||
        (fn.includes(bl) && ln.includes(al))
      );
    });
    if (ranked.length > 0) matters = ranked;
  }

  return matters.slice(0, limit).map((m) => {
    const name = m.person
      ? `${m.person.last_name}, ${m.person.first_name}`
      : (m.matter_number ?? "Matter");
    const doi = m.incident?.date_of_loss
      ? formatDate(m.incident.date_of_loss)
      : "—";
    return {
      client_matter_id: m.client_matter_id,
      label: name,
      sub: `DOI ${doi}`,
      href: matterSearchHref(m.client_matter_id),
      stage: m.current_stage_code,
    };
  });
}
