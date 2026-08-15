/** Episode statuses that mean the client is still in care. */
export const STILL_TREATING_STATUSES = new Set([
  "scheduled",
  "active",
  "gap_concern",
  "noncompliant",
]);

export function isStillTreating(
  episodes: { status: string }[] | null | undefined,
): boolean {
  return (episodes ?? []).some((e) => STILL_TREATING_STATUSES.has(e.status));
}

export function isInLitigation(opts: {
  stage?: string | null;
  hasCourtCase?: boolean;
  hasLitigationParalegal?: boolean;
}): boolean {
  if (opts.stage === "litigation") return true;
  if (opts.hasCourtCase) return true;
  if (opts.hasLitigationParalegal) return true;
  return false;
}

/** Filed (or assigned to lit) while treatment continues — N-CM-08 / F-43. */
export function isDualTrackStillTreating(opts: {
  stage?: string | null;
  hasCourtCase?: boolean;
  hasLitigationParalegal?: boolean;
  episodes?: { status: string }[] | null;
}): boolean {
  return (
    isInLitigation(opts) && isStillTreating(opts.episodes)
  );
}
