import "server-only";
import { db } from "@/lib/db";
import { addDays, dayLabel, daysOfMonth, istDateKey, istTimeLabel, weekdayOf } from "@/lib/dates";
import type { CurrentUser } from "@/domain/auth/types";
import { stateAfter } from "@/domain/attendance/state";
import { isAbandoned, openSince } from "@/domain/attendance/summary";
import type { AttendanceState, DayStatus, EventKind } from "@/domain/attendance/types";
import { managesEmployee } from "@/server/people/hierarchy";
import { currentDay, evaluateDay, loadDayContext, toTimed, type DayContext } from "./record";

export type MonthDay = {
  date: string;
  weekday: number;
  status: DayStatus;
  workedMinutes: number;
  firstIn: string | null;
  lastOut: string | null;
  holidayName: string | null;
  correctionPending: boolean;
  beforeJoining: boolean;
};

export type MonthStats = { averageMinutes: number; fullDays: number; shortDays: number; halfDays: number; absences: number; missingCheckouts: number };

const WORKED: DayStatus[] = ["PRESENT", "SHORT", "HALF_DAY"];

/** Shared by the month view and the monthly report. Days before joining never count against anyone. */
export async function buildMonthDays(
  employeeId: string,
  year: number,
  month: number,
  now: Date,
  ctx: DayContext & { joinedOn: string },
): Promise<{ days: MonthDay[]; stats: MonthStats }> {
  const dates = daysOfMonth(year, month);
  const [events, corrections] = await Promise.all([
    db.attendanceEvent.findMany({ where: { employeeId, workDate: { gte: dates[0], lte: dates.at(-1)! } }, orderBy: { at: "asc" } }),
    db.attendanceCorrection.findMany({ where: { employeeId, status: "PENDING", workDate: { gte: dates[0], lte: dates.at(-1)! } }, select: { workDate: true } }),
  ]);
  const byDate = new Map<string, typeof events>();
  for (const e of events) byDate.set(e.workDate, [...(byDate.get(e.workDate) ?? []), e]);
  const pending = new Set(corrections.map((c) => c.workDate));

  const days = dates.map((date): MonthDay => {
    const { summary, status } = evaluateDay(date, (byDate.get(date) ?? []).map(toTimed), now, ctx);
    return {
      date,
      weekday: weekdayOf(date),
      status,
      workedMinutes: summary.workedMinutes,
      firstIn: summary.firstInAt ? istTimeLabel(summary.firstInAt) : null,
      lastOut: summary.lastOutAt ? istTimeLabel(summary.lastOutAt) : null,
      holidayName: ctx.holidays.get(date) ?? null,
      correctionPending: pending.has(date),
      beforeJoining: date < ctx.joinedOn,
    };
  });

  const counted = days.filter((d) => !d.beforeJoining);
  const worked = counted.filter((d) => WORKED.includes(d.status));
  const count = (s: DayStatus) => counted.filter((d) => d.status === s).length;
  return {
    days,
    stats: {
      averageMinutes: worked.length ? Math.round(worked.reduce((sum, d) => sum + d.workedMinutes, 0) / worked.length) : 0,
      fullDays: count("PRESENT"),
      shortDays: count("SHORT"),
      halfDays: count("HALF_DAY"),
      absences: count("ABSENT"),
      missingCheckouts: count("MISSING_CHECKOUT"),
    },
  };
}

/** Self, HR/Admin and managers anywhere above the person. */
export async function canSeeAttendance(viewer: CurrentUser, employeeId: string): Promise<boolean> {
  if (viewer.employeeId === employeeId || viewer.isHR || viewer.isAdmin) return true;
  return managesEmployee(viewer.employeeId, employeeId);
}

export async function getMonth(
  viewer: CurrentUser,
  employeeId: string,
  year: number,
  month: number,
  now = new Date(),
): Promise<{ ok: true; days: MonthDay[]; stats: MonthStats } | { ok: false; error: string }> {
  if (!(await canSeeAttendance(viewer, employeeId))) return { ok: false, error: "You can't see this person's attendance." };
  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { joinedOn: true } });
  if (!employee) return { ok: false, error: "That person doesn't exist." };
  const ctx = await loadDayContext();
  return { ok: true, ...(await buildMonthDays(employeeId, year, month, now, { ...ctx, joinedOn: employee.joinedOn })) };
}

export type TodayView = {
  workDate: string;
  state: AttendanceState;
  events: { kind: EventKind; at: string; time: string }[];
  workedMinutes: number;
  /** ISO time the numbers were computed at; the clock card ticks forward from here while working. */
  asOf: string;
  startedAt: string | null;
  requiredMinutes: number;
};

export async function getToday(employeeId: string, now = new Date()): Promise<TodayView> {
  const [ctx, day] = await Promise.all([loadDayContext(), currentDay(db, employeeId, now)]);
  const { summary } = evaluateDay(day.workDate, day.events.map(toTimed), now, ctx);
  const lastIn = [...day.events].reverse().find((e) => e.kind === "IN");
  return {
    workDate: day.workDate,
    state: day.state,
    events: day.events.map((e) => ({ kind: e.kind as EventKind, at: e.at.toISOString(), time: istTimeLabel(e.at) })),
    workedMinutes: summary.workedMinutes,
    asOf: now.toISOString(),
    startedAt: day.state === "WORKING" || day.state === "ON_BREAK" ? (lastIn?.at.toISOString() ?? null) : null,
    requiredMinutes: ctx.settings["attendance.requiredDailyMinutes"],
  };
}

/** The last `count` working days (weekends skipped, holidays kept) ending today, oldest first. */
export async function getRecentHours(
  employeeId: string,
  now = new Date(),
  count = 10,
): Promise<{ date: string; label: string; minutes: number; today: boolean; holidayName: string | null }[]> {
  const ctx = await loadDayContext();
  const today = istDateKey(now);
  const dates: string[] = [];
  for (let d = today; dates.length < count; d = addDays(d, -1)) {
    if (!ctx.settings["work.weekendDays"].includes(weekdayOf(d))) dates.unshift(d);
  }
  const events = await db.attendanceEvent.findMany({ where: { employeeId, workDate: { in: dates } }, orderBy: { at: "asc" } });
  return dates.map((date) => {
    const { summary } = evaluateDay(date, events.filter((e) => e.workDate === date).map(toTimed), now, ctx);
    return { date, label: dayLabel(date).split(" ").slice(0, 2).join(" "), minutes: summary.workedMinutes, today: date === today, holidayName: ctx.holidays.get(date) ?? null };
  });
}

export type Presence = "IN" | "BREAK" | "OUT" | "NOT_IN";

/** Live presence (and first check-in time today) for many people in two queries. */
export async function presenceOf(employeeIds: string[], now = new Date()): Promise<Map<string, { state: Presence; since: string | null }>> {
  const today = istDateKey(now);
  const events = await db.attendanceEvent.findMany({
    where: { employeeId: { in: employeeIds }, workDate: { in: [today, addDays(today, -1)] } },
    orderBy: { at: "asc" },
  });
  const result = new Map<string, { state: Presence; since: string | null }>();
  for (const id of employeeIds) {
    const mine = events.filter((e) => e.employeeId === id);
    const yesterday = mine.filter((e) => e.workDate !== today);
    const yTimed = yesterday.map(toTimed);
    const yState = stateAfter(yTimed);
    const liveYesterday = (yState === "WORKING" || yState === "ON_BREAK") && !isAbandoned(openSince(yTimed) ?? yesterday.at(-1)!.at, now);
    const day = liveYesterday ? yesterday : mine.filter((e) => e.workDate === today);
    const state = stateAfter(day.map(toTimed));
    const firstIn = day.find((e) => e.kind === "IN");
    result.set(id, {
      state: state === "WORKING" ? "IN" : state === "ON_BREAK" ? "BREAK" : state === "CHECKED_OUT" ? "OUT" : "NOT_IN",
      since: firstIn ? istTimeLabel(firstIn.at) : null,
    });
  }
  return result;
}

export async function todayStateMap(employeeIds: string[], now = new Date()): Promise<Map<string, Presence>> {
  const presence = await presenceOf(employeeIds, now);
  return new Map([...presence].map(([id, p]) => [id, p.state]));
}
