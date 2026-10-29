import "server-only";
import "./types";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";
import { timeAgo } from "@/lib/time";
import { describeStep, listMyRequests, listPendingFor, namesFor } from "./engine";
import { getApprovalHooks } from "./registry";

export type InboxItem = { id: string; label: string; summary: string; detail: string | null; requester: string; ago: string };
export type MyRequest = { id: string; label: string; summary: string; status: string; where: string; ago: string; canWithdraw: boolean };

export async function getInbox(actor: CurrentUser, now = new Date()): Promise<{ waiting: InboxItem[]; mine: MyRequest[] }> {
  const [waiting, mine] = await Promise.all([listPendingFor(actor), listMyRequests(actor, 20)]);
  const names = await namesFor([...waiting, ...mine]);
  const waitingItems = await Promise.all(
    waiting.map(async (r) => {
      const hooks = getApprovalHooks(r.type);
      const ref = { id: r.id, type: r.type, subjectId: r.subjectId, requesterId: r.requesterId, summary: r.summary };
      return {
        id: r.id,
        label: hooks.label,
        summary: r.summary,
        detail: hooks.detail ? await hooks.detail(db, ref) : null,
        requester: names.get(r.requesterId) ?? "Someone",
        ago: timeAgo(r.createdAt, now),
      };
    }),
  );
  return {
    waiting: waitingItems,
    mine: mine.map((r) => ({
      id: r.id,
      label: getApprovalHooks(r.type).label,
      summary: r.summary,
      status: r.status,
      where: describeStep(r, names),
      ago: timeAgo(r.createdAt, now),
      canWithdraw: r.status === "PENDING",
    })),
  };
}
