import {
  RoleAttentionNotices,
} from "@/components/workspace/RoleAttentionNotices";
import { cmAttentionCards } from "@/lib/workspace/attentionNotices";
import type { CaseloadRow } from "@/lib/cases/types";

/**
 * Case Manager “Needs attention” — attorney-style story cards, assigned only.
 */
export function NeedsAttentionBoard({
  rows,
  hrefBase = "/cases",
  emptyHint = "Nothing flagged on your assigned caseload.",
}: {
  rows: CaseloadRow[];
  hrefBase?: string;
  emptyHint?: string;
}) {
  const cards = cmAttentionCards(rows, hrefBase);
  const hotCount = cards.length;

  return (
    <RoleAttentionNotices
      title="Needs attention"
      subtitle={
        hotCount > 0
          ? `${hotCount} top item${hotCount === 1 ? "" : "s"} on your assigned caseload — not firm-wide`
          : "Assigned matters only — not the firm-wide attorney queue"
      }
      cards={cards}
      emptyHint={emptyHint}
      primaryCta={
        rows.some((r) => r.flag_provider_check_overdue)
          ? { href: "/cases/calls", label: "Provider calls" }
          : rows.some((r) => r.flag_pd_unresolved)
            ? { href: "/cases/pd", label: "PD pending" }
            : rows.some((r) => r.flag_records_not_ordered)
              ? { href: "/cases/records", label: "Records pending" }
              : { href: "/cases/new-cases", label: "New cases" }
      }
    />
  );
}
