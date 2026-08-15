/**
 * GATE-11 — louder warning when coverage boxes are unanswered.
 * Does not block demand draft or stage advance (consult before that).
 */
export function CoverageIncompleteBanner({
  unanswered,
  total,
  onJump,
}: {
  unanswered: number;
  total: number;
  onJump?: () => void;
}) {
  if (unanswered <= 0) return null;
  return (
    <div
      className="rounded-panel border border-danger/40 bg-danger-bg px-4 py-3 text-sm"
      role="status"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-danger">
        Coverage boxes unanswered
      </p>
      <p className="mt-1 text-ink">
        {unanswered} of {total} categories still need a provider or{" "}
        <span className="font-semibold">No treatment</span>. Missed ambulance /
        EMS bills become surprise liens.
      </p>
      {onJump ? (
        <button
          type="button"
          onClick={onJump}
          className="mt-2 text-sm font-semibold text-danger underline-offset-2 hover:underline"
        >
          Open coverage boxes
        </button>
      ) : null}
    </div>
  );
}
