import type { LeadStatus } from "./types";

/** GATE-02 / H-02 / N-INT-04 — rejection is incomplete until NEL is recorded. */

export const NEL_OUTSTANDING_MESSAGE =
  "Rejection is incomplete until the non-engagement letter is recorded.";

export const NEL_BLOCKS_DELETE_MESSAGE =
  "Cannot delete a rejected lead until the non-engagement letter is recorded.";

export const NEL_BLOCKS_MATTER_MESSAGE =
  "Cannot open a matter on a rejected lead. Record the non-engagement letter, or reopen the lead first.";

export const NEL_ONLY_ON_REJECTED_MESSAGE =
  "Non-engagement letter is only recorded on a rejected lead.";

export function isNelOutstanding(lead: {
  status: string;
  non_engagement_letter_sent_date?: string | null;
}): boolean {
  return lead.status === "rejected" && !lead.non_engagement_letter_sent_date;
}

/**
 * While NEL is outstanding, the lead may stay rejected or reopen to Open
 * (firm decided to take the case — NEL is no longer the close path).
 * Every other status is a close/skip that would drop the malpractice control.
 */
export function nelBlocksStatusChange(
  current: {
    status: string;
    non_engagement_letter_sent_date?: string | null;
  },
  nextStatus: LeadStatus,
): string | null {
  if (!isNelOutstanding(current)) return null;
  if (nextStatus === "rejected" || nextStatus === "open") return null;
  return `${NEL_OUTSTANDING_MESSAGE} Record the letter, or reopen the lead to Open.`;
}
