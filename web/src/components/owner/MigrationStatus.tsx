import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { STAGE_LABEL } from "@/lib/cases/types";
import { matterHref } from "@/lib/owner/types";
import type { MigrationStats } from "@/lib/owner/migration";

export function MigrationStatus({ stats }: { stats: MigrationStats }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Phase 10 · CasePeer
        </p>
        <h1 className="text-2xl font-bold">Migration status</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Read-only view of matters loaded with a{" "}
          <code className="text-xs">casepeer_case_id</code>. The load itself is
          owner-run from Dropbox CSVs — never through this UI or git. See{" "}
          <code className="text-xs">docs/CASEPEER_MIGRATION.md</code>.
        </p>
      </div>

      <div className="rounded-panel border border-warning/40 bg-warning-bg/40 px-4 py-3 text-sm">
        <p className="font-semibold text-ink">Gates (owner)</p>
        <ul className="mt-1 list-inside list-disc text-muted">
          <li>10.1 CSVs stay in Dropbox only</li>
          <li>10.2 Run via <code className="text-xs">./scripts/run_casepeer_migrate.sh</code></li>
          <li>10.3 Battery + SOL / flag review after load</li>
          <li>10.4 Dropbox = frozen archive (no bidirectional sync)</li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="CasePeer matters"
          value={String(stats.casepeerMatters)}
        />
        <Stat
          label="SOL needs_review"
          value={String(stats.solNeedsReview)}
          hot={stats.solNeedsReview > 0}
        />
        <Stat
          label="Stages present"
          value={String(stats.byStage.length)}
        />
      </div>

      {stats.casepeerMatters === 0 ? (
        <p className="rounded-panel border border-grid bg-surface px-4 py-8 text-sm text-muted shadow-soft">
          No CasePeer-keyed matters yet. When ready, export CSVs to Dropbox and
          run the owner script on a BAA-covered database. Demo seeds without a
          CasePeer id are unrelated.
        </p>
      ) : (
        <>
          <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
            <div className="border-b border-grid px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
              By stage
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-grid text-xs text-muted">
                  <th className="px-4 py-2 font-semibold">Stage</th>
                  <th className="px-4 py-2 font-semibold">Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.byStage.map((s) => (
                  <tr key={s.stage} className="border-b border-grid">
                    <td className="px-4 py-2">
                      {STAGE_LABEL[s.stage] ?? s.stage}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-grid px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Recent CasePeer matters
              </span>
              <Link
                href="/owner/sol"
                className="text-xs font-semibold text-accent-dk hover:underline"
              >
                Open SOL Watch →
              </Link>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-grid text-xs text-muted">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">CasePeer id</th>
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                  <th className="px-4 py-2.5 font-semibold">SOL</th>
                  <th className="px-4 py-2.5 font-semibold">SOL status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r) => (
                  <tr key={r.client_matter_id} className="border-b border-grid">
                    <td className="px-4 py-3">
                      <Link
                        href={matterHref(r.current_stage_code, r.client_matter_id)}
                        className="font-semibold text-accent-dk hover:underline"
                      >
                        {r.client}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.casepeer_case_id}
                    </td>
                    <td className="px-4 py-3">
                      {STAGE_LABEL[r.current_stage_code] ?? r.current_stage_code}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(r.sol_date)}
                    </td>
                    <td className="px-4 py-3 text-xs">{r.sol_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className="rounded-panel border border-grid bg-surface px-4 py-3 shadow-soft">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          hot ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
