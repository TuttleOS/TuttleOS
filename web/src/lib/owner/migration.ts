import { createClient } from "@/lib/supabase/server";

export type MigrationStats = {
  casepeerMatters: number;
  solNeedsReview: number;
  byStage: { stage: string; n: number }[];
  recent: {
    client_matter_id: string;
    casepeer_case_id: string;
    client: string;
    current_stage_code: string;
    sol_date: string | null;
    sol_status: string;
  }[];
};

export async function getMigrationStats(): Promise<MigrationStats> {
  const supabase = createClient();

  const { data: matters, error } = await supabase
    .schema("core")
    .from("client_matter")
    .select(
      `client_matter_id, casepeer_case_id, current_stage_code, sol_date, sol_status,
       person:client_person_id(first_name, last_name)`,
    )
    .not("casepeer_case_id", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const rows = matters ?? [];
  const stageMap = new Map<string, number>();
  let solNeedsReview = 0;

  const recent = rows.slice(0, 25).map((r) => {
    const person = r.person as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    const client = person
      ? `${person.last_name}, ${person.first_name}`
      : "—";
    return {
      client_matter_id: r.client_matter_id as string,
      casepeer_case_id: r.casepeer_case_id as string,
      client,
      current_stage_code: r.current_stage_code as string,
      sol_date: (r.sol_date as string | null) ?? null,
      sol_status: r.sol_status as string,
    };
  });

  for (const r of rows) {
    const stage = (r.current_stage_code as string) || "unknown";
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
    if (r.sol_status === "needs_review") solNeedsReview += 1;
  }

  const byStage = Array.from(stageMap.entries())
    .map(([stage, n]) => ({ stage, n }))
    .sort((a, b) => b.n - a.n);

  return {
    casepeerMatters: rows.length,
    solNeedsReview,
    byStage,
    recent,
  };
}
