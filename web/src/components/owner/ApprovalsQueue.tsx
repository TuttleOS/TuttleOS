"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STAGE_LABEL } from "@/lib/cases/types";
import {
  approveDemandAction,
  approveLevelAction,
} from "@/lib/owner/actions";
import { matterHref, type ApprovalItem } from "@/lib/owner/types";

export function ApprovalsQueue({
  items,
  canApprove,
}: {
  items: ApprovalItem[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error ?? "Failed");
      else setMsg(res.message ?? "Done");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Owner dashboard
        </p>
        <h1 className="text-2xl font-bold">Approvals</h1>
        <p className="text-sm text-muted">
          Level stamps are enforced by{" "}
          <code className="text-xs">core.enforce_level_approval</code>. L3
          demands require attorney approval after Kate review.
        </p>
      </div>

      {msg && <p className="text-sm font-semibold text-success">{msg}</p>}
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {items.length === 0 ? (
        <section className="rounded-panel border border-grid bg-surface p-8 text-muted shadow-soft">
          No pending approvals.
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((item) =>
            item.kind === "level" ? (
              <section
                key={`level-${item.client_matter_id}`}
                className="rounded-panel border border-grid bg-surface p-5 shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded bg-info-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-info">
                      Level
                    </span>
                    <h2 className="mt-2 text-lg font-bold">
                      <Link
                        href={matterHref(
                          item.current_stage_code,
                          item.client_matter_id,
                        )}
                        className="text-accent-dk no-underline hover:underline"
                      >
                        {item.display_name}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted">
                      {STAGE_LABEL[item.current_stage_code] ??
                        item.current_stage_code}{" "}
                      · Recommended L{item.recommended_level}
                    </p>
                    {item.recommended_level_rationale && (
                      <p className="mt-2 text-sm">
                        {item.recommended_level_rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending || !canApprove}
                      onClick={() =>
                        run(() =>
                          approveLevelAction(
                            item.client_matter_id,
                            item.recommended_level,
                          ),
                        )
                      }
                      className="rounded-lg bg-accent-dk px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      Approve L{item.recommended_level}
                    </button>
                    {[1, 2, 3].map((lvl) =>
                      lvl !== item.recommended_level ? (
                        <button
                          key={lvl}
                          type="button"
                          disabled={pending || !canApprove}
                          onClick={() =>
                            run(() =>
                              approveLevelAction(item.client_matter_id, lvl),
                            )
                          }
                          className="rounded-lg border border-grid px-3 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
                        >
                          Set L{lvl}
                        </button>
                      ) : null,
                    )}
                  </div>
                </div>
                {!canApprove && (
                  <p className="mt-3 text-xs text-danger">
                    Your staff record lacks can_approve_level.
                  </p>
                )}
              </section>
            ) : (
              <section
                key={`demand-${item.demand_id}`}
                className="rounded-panel border border-grid bg-surface p-5 shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded bg-warning-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning">
                      L3 Demand
                    </span>
                    <h2 className="mt-2 text-lg font-bold">
                      <Link
                        href={`/cases/${item.client_matter_id}`}
                        className="text-accent-dk no-underline hover:underline"
                      >
                        {item.display_name}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted">
                      Matter Level {item.approved_level ?? "—"} · Kate reviewed
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending || !canApprove}
                    onClick={() =>
                      run(() =>
                        approveDemandAction(
                          item.demand_id,
                          item.client_matter_id,
                        ),
                      )
                    }
                    className="rounded-lg bg-accent-dk px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Approve demand
                  </button>
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
