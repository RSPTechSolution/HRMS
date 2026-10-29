import "server-only";
import type { Db, DbTx } from "@/server/db-types";

export type ApprovalRef = { id: string; type: string; subjectId: string; requesterId: string; summary: string };

export type ApprovalHooks = {
  label: string;
  link?: (ref: ApprovalRef) => string;
  /** Extra context shown to approvers, e.g. the reason the person gave. */
  detail?: (client: Db, ref: ApprovalRef) => Promise<string | null>;
  onApproved?: (tx: DbTx, ref: ApprovalRef) => Promise<void>;
  onClosed?: (tx: DbTx, ref: ApprovalRef, status: "DECLINED" | "WITHDRAWN") => Promise<void>;
};

const registry = new Map<string, ApprovalHooks>();

export function registerApprovalType(type: string, hooks: ApprovalHooks): void {
  registry.set(type, hooks);
}

export function getApprovalHooks(type: string): ApprovalHooks {
  return registry.get(type) ?? { label: type };
}
