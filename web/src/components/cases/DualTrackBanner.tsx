/**
 * N-CM-08 / F-43 — visible when the file is in litigation and the client
 * is still treating. Does not calendar 18.001 / discovery / depo (tie-breaker
 * still open). Additive banner only.
 */
export function DualTrackBanner({
  lane,
}: {
  lane: "cm" | "litigation";
}) {
  return (
    <div
      className="rounded-panel border border-warning/50 bg-warning-bg px-4 py-3 text-sm"
      role="status"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-warning">
        Client still treating
      </p>
      {lane === "cm" ? (
        <p className="mt-1 text-ink">
          This file is in litigation while treatment continues. Coordinate{" "}
          <span className="font-semibold">§18.001</span>, discovery, and the
          plaintiff deposition with the litigation paralegal — do not calendar
          those as if treatment were over.
        </p>
      ) : (
        <p className="mt-1 text-ink">
          Medical track is still with the case manager.{" "}
          <span className="font-semibold">§18.001</span>, discovery, and
          plaintiff-depo dates change while treatment continues — coordinate
          with the CM before setting those.
        </p>
      )}
    </div>
  );
}
