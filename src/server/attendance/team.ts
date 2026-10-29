import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";
import { visibleReportIds } from "@/server/people/hierarchy";
import { presenceOf, type Presence } from "./views";

export type TeamToday = {
  counts: { in: number; onBreak: number; out: number; notIn: number };
  people: { id: string; fullName: string; designation: string | null; state: Presence; since: string | null }[];
};

/** Who is in right now across the viewer's team. Null for people who manage nobody. */
export async function getTeamToday(viewer: CurrentUser, now = new Date()): Promise<TeamToday | null> {
  const visible = await visibleReportIds(viewer);
  if (visible !== "ALL" && visible.length === 0) return null;
  const people = await db.employee.findMany({
    where: { status: { not: "EXITED" }, id: visible === "ALL" ? { not: viewer.employeeId } : { in: visible } },
    select: { id: true, fullName: true, designation: { select: { title: true } } },
    orderBy: { fullName: "asc" },
  });
  const presence = await presenceOf(people.map((p) => p.id), now);
  const rows = people.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    designation: p.designation?.title ?? null,
    state: presence.get(p.id)?.state ?? ("NOT_IN" as Presence),
    since: presence.get(p.id)?.since ?? null,
  }));
  const count = (s: Presence) => rows.filter((r) => r.state === s).length;
  return { counts: { in: count("IN"), onBreak: count("BREAK"), out: count("OUT"), notIn: count("NOT_IN") }, people: rows };
}
