"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatDate } from "@/lib/dates";
import type { TaskRow } from "@/lib/cases/types";
import {
  completeLitTaskAction,
  reopenLitTaskAction,
} from "@/lib/litigation/actions";
import { LIT_TASK_GROUPS, taskGroupKey } from "@/lib/litigation/types";

export function LitMyTasks({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const g of [...LIT_TASK_GROUPS, { key: "general", label: "General", match: /./ }]) {
      map.set(g.key, []);
    }
    for (const t of tasks) {
      const key = taskGroupKey(t.title, t.task_type, t.trigger_source);
      const list = map.get(key) ?? map.get("general")!;
      list.push(t);
    }
    return map;
  }, [tasks]);

  function toggle(t: TaskRow) {
    setErr(null);
    start(async () => {
      const res =
        t.status === "done"
          ? await reopenLitTaskAction(t.task_id, t.client_matter_id ?? undefined)
          : await completeLitTaskAction(t.task_id, t.client_matter_id ?? undefined);
      if (!res.ok) setErr(res.error ?? "Failed");
      router.refresh();
    });
  }

  const groups = [
    ...LIT_TASK_GROUPS,
    { key: "general", label: "General", match: /./ },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent-dk">
          Litigation Paralegal workspace
        </p>
        <h1 className="text-xl font-bold">My Tasks</h1>
        <p className="text-sm text-muted">
          Grouped by litigation stage. Same task records as the matter page.
        </p>
      </div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}

      {tasks.length === 0 ? (
        <section className="rounded-panel border border-grid bg-surface p-8 text-muted shadow-soft">
          No open litigation tasks assigned to you.
        </section>
      ) : (
        groups.map((g) => {
          const list = grouped.get(g.key) ?? [];
          if (list.length === 0) return null;
          return (
            <section
              key={g.key}
              className="overflow-hidden rounded-panel border border-grid bg-surface shadow-soft"
            >
              <div className="border-b border-grid px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted">
                {g.label} · {list.length}
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {list.map((t) => (
                    <tr key={t.task_id} className="border-b border-grid">
                      <td className="w-10 px-5 py-3">
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
                            href={`/litigation/${t.client_matter_id}`}
                            className="text-accent-dk no-underline hover:underline"
                          >
                            {t.matter_label ?? "Matter"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {t.due_date ? formatDate(t.due_date) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </div>
  );
}
