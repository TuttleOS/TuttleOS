import type { LeadRow } from "./types";

export function leadDisplayName(lead: LeadRow): string {
  if (lead.person) {
    return `${lead.person.last_name}, ${lead.person.first_name}`;
  }
  if (lead.raw_name) return lead.raw_name;
  return "Unnamed lead";
}
