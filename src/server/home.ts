import "server-only";
import type { CurrentUser } from "@/domain/auth/types";
import { greetingFor, longDateIST, timeAgo } from "@/lib/time";
import { listNotifications } from "./notifications";

export async function getHomeView(user: CurrentUser, now = new Date()) {
  const notes = await listNotifications(user.userId, 5);
  return {
    dateLabel: longDateIST(now),
    heading: `${greetingFor(now)}, ${user.fullName.split(" ")[0]}.`,
    notes: notes.map((n) => ({ id: n.id, title: n.title, ago: timeAgo(n.createdAt, now) })),
  };
}
