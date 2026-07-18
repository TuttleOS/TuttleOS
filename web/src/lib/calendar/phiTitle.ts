import type { DeadlineCalendarEvent } from "./types";

/**
 * Build calendar title/body without medical narrative (gate 9.2).
 * Uses label + matter_number — not notes, treatment, or clinical text.
 */
export function buildDeadlineCalendarEvent(input: {
  deadlineId: string;
  label: string;
  effectiveDate: string;
  jurisdictional: boolean;
  status: string;
  source: string | null;
  ruleCode: string | null;
  matterId: string | null;
  matterNumber: string | null;
}): DeadlineCalendarEvent {
  const matterBit = input.matterNumber?.trim()
    ? ` · ${input.matterNumber.trim()}`
    : "";
  const jx = input.jurisdictional ? " [JX]" : "";
  const title = `${input.label}${matterBit}${jx}`.slice(0, 200);

  const verify =
    input.source === "rule" || input.ruleCode
      ? " ATTORNEY-VERIFY rule-computed date."
      : "";
  const body = [
    `Status: ${input.status}`,
    input.source ? `Source: ${input.source}` : null,
    input.ruleCode ? `Rule: ${input.ruleCode}` : null,
    verify.trim() || null,
    "Tuttle OS — do not paste medical narrative into calendar events.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    deadlineId: input.deadlineId,
    title,
    body,
    effectiveDate: input.effectiveDate,
    allDay: true,
    jurisdictional: input.jurisdictional,
    status: input.status,
    matterId: input.matterId,
    deepLinkPath: input.matterId
      ? `/litigation/${input.matterId}`
      : null,
  };
}

export function payloadHash(event: DeadlineCalendarEvent): string {
  const raw = `${event.title}|${event.effectiveDate}|${event.status}|${event.body}`;
  // Simple non-crypto fingerprint for change detection (sufficient for dry-run MVP)
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(h).toString(16)}`;
}
