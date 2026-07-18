import { listLeads } from "@/lib/intake/queries";
import type { LeadStatus } from "@/lib/intake/types";
import { LeadQueue } from "@/components/intake/LeadQueue";

export default async function IntakeQueuePage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const raw = searchParams.status ?? "all";
  const filter = (
    [
      "all",
      "open",
      "contract_sent",
      "signed",
      "rejected",
      "no_response",
      "referred_out",
      "duplicate",
    ].includes(raw)
      ? raw
      : "all"
  ) as LeadStatus | "all";

  const leads = await listLeads("all");

  return <LeadQueue leads={leads} filter={filter} />;
}
