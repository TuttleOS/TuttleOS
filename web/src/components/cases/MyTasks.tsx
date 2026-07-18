"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import { completeTaskAction, reopenTaskAction } from "@/lib/cases/actions";
import type { TaskRow } from "@/lib/cases/types";

export function MyTasks({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle(t: TaskRow) {
    setErr(null);
    start(async () => {
      const res =
        t.status === "done"
          ? await reopenTaskAction(t.task_id)
          : await completeTaskAction(t.task_id);
      if (!res.ok) setErr(res.error ?? "Failed");
      router.refresh();
    });
  }

  return (
    <section className="rounded-panel border border-grid bg-surface shadow-soft">
      <div className="border-b border-grid px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Case Manager workspace
        </p>
        <h1 className="text-xl font-bold">My Tasks</h1>
        <p className="text-sm text-muted">
          Same records as the case checklist — complete here or on the matter
          page.
        </p>
      </div>
      {err && (
        <p className="mx-5 mt-3 text-sm font-semibold text-danger">{err}</p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-grid text-xs text-muted">
            <th className="w-10 px-5 py-2 font-semibold" />
            <th className="px-5 py-2 font-semibold">Task</th>
            <th className="px-5 py-2 font-semibold">Case</th>
            <th className="px-5 py-2 font-semibold">Source</th>
            <th className="px-5 py-2 font-semibold">Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-10 text-muted">
                No open tasks assigned to you.
              </td>
            </tr>
          ) : (
            tasks.map((t) => (
              <tr key={t.task_id} className="border-b border-grid">
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={t.status === "done"}
                    disabled={pending}
                    onChange={() => toggle(t)}
                  />
                </td>
                <td className="px-5 py-3 font-semibold">{t.title}</td>
                <td className="px-5 py-3">
                  {t.client_matter_id ? (
                    <Link
                      href={`/cases/${t.client_matter_id}`}
                      className="text-accent-dk no-underline hover:underline"
                    >
                      {t.matter_label ?? "Matter"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-muted">
                  {t.trigger_source ?? t.task_type ?? "—"}
                </td>
                <td className="px-5 py-3 text-xs">
                  {t.due_date ? formatDate(t.due_date) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
