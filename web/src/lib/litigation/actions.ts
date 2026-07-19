"use server";

import { revalidatePath } from "next/cache";
import {
  completeTaskAction as completeCaseTask,
  reopenTaskAction as reopenCaseTask,
  createFollowUpTaskAction as createCaseFollowUp,
  addNoteAction as addCaseNote,
  type ActionResult,
} from "@/lib/cases/actions";

async function revalidateLit(matterId?: string | null) {
  revalidatePath("/litigation");
  revalidatePath("/litigation/tasks");
  revalidatePath("/litigation/deadlines");
  if (matterId) revalidatePath(`/litigation/${matterId}`);
}

export async function completeLitTaskAction(
  taskId: string,
  matterId?: string,
): Promise<ActionResult> {
  const res = await completeCaseTask(taskId);
  await revalidateLit(matterId);
  return res;
}

export async function reopenLitTaskAction(
  taskId: string,
  matterId?: string,
): Promise<ActionResult> {
  const res = await reopenCaseTask(taskId);
  await revalidateLit(matterId);
  return res;
}

export async function createLitFollowUpAction(input: {
  client_matter_id: string;
  title: string;
  due_date: string;
  description?: string;
}): Promise<ActionResult> {
  const res = await createCaseFollowUp(input);
  await revalidateLit(input.client_matter_id);
  return res;
}

export async function addLitNoteAction(
  matterId: string,
  body: string,
  opts?: { pinned?: boolean; shareToCompanions?: boolean },
): Promise<ActionResult> {
  const res = await addCaseNote(matterId, body, opts);
  await revalidateLit(matterId);
  return res;
}
