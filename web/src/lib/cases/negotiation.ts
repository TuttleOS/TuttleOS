/**
 * Negotiation ledger directionality (Stage 1 integrity rule):
 * - Offers / counters originate from the insurer (defense)
 * - Counter-demands originate from the firm (plaintiff)
 * - Client authority is logged as the client
 * Other event types (impasse, acceptance, etc.) keep a free side.
 */

export const NEGOTIATION_SIDES = [
  "plaintiff",
  "defense",
  "client",
  "mediator",
] as const;

export type NegotiationSide = (typeof NEGOTIATION_SIDES)[number];

/** Side required for this event type, or null if any side is allowed. */
export function requiredSideForEventType(
  eventType: string,
): NegotiationSide | null {
  switch (eventType) {
    case "offer":
    case "counter_offer":
    case "mediation_offer":
    case "rule_167_offer":
      return "defense";
    case "counter_demand":
      return "plaintiff";
    case "client_authority_obtained":
      return "client";
    default:
      return null;
  }
}

export function defaultSideForEventType(eventType: string): NegotiationSide {
  return requiredSideForEventType(eventType) ?? "defense";
}

/** Human-readable error, or null if valid. */
export function validateNegotiationDirectionality(
  eventType: string,
  bySide: string,
): string | null {
  const required = requiredSideForEventType(eventType);
  if (!required) return null;
  if (bySide === required) return null;

  const labels: Record<string, string> = {
    offer: "Offers",
    counter_offer: "Counter-offers",
    mediation_offer: "Mediation offers",
    rule_167_offer: "Rule 167 offers",
    counter_demand: "Counter-demands",
    client_authority_obtained: "Client authority",
  };
  const sideLabels: Record<NegotiationSide, string> = {
    plaintiff: "plaintiff (firm)",
    defense: "defense (insurer)",
    client: "client",
    mediator: "mediator",
  };
  const what = labels[eventType] ?? "This event";
  return `${what} must be logged as ${sideLabels[required]} — not ${bySide}.`;
}

export function sideLockedForEventType(eventType: string): boolean {
  return requiredSideForEventType(eventType) != null;
}
