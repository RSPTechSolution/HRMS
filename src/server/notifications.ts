import "server-only";
import { db } from "@/lib/db";
import type { Db } from "./db-types";

export type NewNotification = { kind: string; title: string; link?: string };

export async function notifyEmployees(tx: Db, employeeIds: string[], n: NewNotification): Promise<void> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return;
  const users = await tx.user.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
  if (users.length === 0) return;
  await tx.notification.createMany({
    data: users.map((u) => ({ userId: u.id, kind: n.kind, title: n.title, link: n.link ?? null })),
  });
}

export function listNotifications(userId: string, take = 20) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string, now = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}
