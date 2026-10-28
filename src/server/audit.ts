import "server-only";
import { db } from "@/lib/db";
import type { Db } from "./db-types";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

const toJson = (v: unknown): string | null => (v === undefined ? null : JSON.stringify(v));

export async function writeAudit(tx: Db, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}

export function listAudit(filter: { entityType?: string; entityId?: string; take?: number }) {
  return db.auditLog.findMany({
    where: { entityType: filter.entityType, entityId: filter.entityId },
    orderBy: { at: "desc" },
    take: filter.take ?? 100,
  });
}
