import "server-only";
import { timeAgo } from "@/lib/time";
import type { BellItem } from "@/components/shell/NotificationsBell";
import { listNotifications, unreadCount } from "./notifications";

export async function getShellView(userId: string, now = new Date()): Promise<{ items: BellItem[]; unread: number }> {
  const [notes, unread] = await Promise.all([listNotifications(userId, 15), unreadCount(userId)]);
  return {
    unread,
    items: notes.map((n) => ({ id: n.id, title: n.title, link: n.link, ago: timeAgo(n.createdAt, now), read: n.readAt !== null })),
  };
}
