import "server-only";
import "./approvals/types";
import type { CurrentUser } from "@/domain/auth/types";
import { istDateKey, monthOf } from "@/lib/dates";
import { greetingFor, longDateIST, timeAgo } from "@/lib/time";
import { listPendingFor } from "./approvals/engine";
import { getTeamToday } from "./attendance/team";
import { getMonth, getRecentHours, getToday } from "./attendance/views";
import { listNotifications } from "./notifications";

/** Everything the dashboard shows, prepared on the server (components never read the clock). */
export async function getHomeView(user: CurrentUser, now = new Date()) {
  const { year, month } = monthOf(istDateKey(now));
  const [notes, today, recent, monthView, waiting, team] = await Promise.all([
    listNotifications(user.userId, 5),
    getToday(user.employeeId, now),
    getRecentHours(user.employeeId, now),
    getMonth(user, user.employeeId, year, month, now),
    listPendingFor(user),
    getTeamToday(user, now),
  ]);
  const worked = recent.filter((d) => !d.today && d.minutes > 0);
  const stats = monthView.ok ? monthView.stats : null;
  return {
    dateLabel: longDateIST(now),
    heading: `${greetingFor(now)}, ${user.fullName.split(" ")[0]}.`,
    today,
    recent,
    kpis: {
      averageMinutes: worked.length ? Math.round(worked.reduce((sum, d) => sum + d.minutes, 0) / worked.length) : 0,
      fullDaysThisMonth: stats?.fullDays ?? 0,
      shortDaysThisMonth: (stats?.shortDays ?? 0) + (stats?.halfDays ?? 0),
      toReview: waiting.length,
    },
    team,
    notes: notes.map((n) => ({ id: n.id, title: n.title, ago: timeAgo(n.createdAt, now) })),
  };
}

export type HomeView = Awaited<ReturnType<typeof getHomeView>>;
