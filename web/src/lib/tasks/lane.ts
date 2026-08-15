import { LIT_TASK_GROUPS } from "@/lib/litigation/types";

/** Lit groups that are paralegal work — not the CM sign-up checklist. */
const CM_HIDDEN_LIT_GROUP_KEYS = new Set([
  "filing",
  "answers",
  "discovery",
  "depo",
  "trial",
]);

/**
 * True when a task belongs on the litigation paralegal lane.
 * Mediation-with-client stays visible to the CM (dual-track).
 */
export function isLitigationLaneTask(task: {
  title: string;
  task_type?: string | null;
  trigger_source?: string | null;
}): boolean {
  if (task.task_type === "litigation") return true;
  const blob = `${task.title} ${task.task_type ?? ""} ${task.trigger_source ?? ""}`;
  for (const g of LIT_TASK_GROUPS) {
    if (CM_HIDDEN_LIT_GROUP_KEYS.has(g.key) && g.match.test(blob)) {
      return true;
    }
  }
  return false;
}

export function excludeLitigationLaneTasks<T extends {
  title: string;
  task_type?: string | null;
  trigger_source?: string | null;
}>(tasks: T[]): T[] {
  return tasks.filter((t) => !isLitigationLaneTask(t));
}
