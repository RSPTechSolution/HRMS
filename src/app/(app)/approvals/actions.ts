"use server";
import { revalidatePath } from "next/cache";
import "@/server/approvals/types";
import type { Decision } from "@/domain/approvals/types";
import { decideApproval, withdrawApproval } from "@/server/approvals/engine";
import { requireUser } from "@/server/auth/current-user";

export async function decideAction(requestId: string, decision: Decision, comment?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (decision !== "APPROVED" && decision !== "DECLINED") return { ok: false, error: "Pick approve or decline." };
  const result = await decideApproval(user, requestId, decision, comment);
  revalidatePath("/", "layout");
  return result.ok ? { ok: true } : result;
}

export async function withdrawAction(requestId: string): Promise<void> {
  const user = await requireUser();
  await withdrawApproval(user, requestId);
  revalidatePath("/", "layout");
}
