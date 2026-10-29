import "server-only";
import { db } from "@/lib/db";
import { addDays, istDateKey, weekdayOf } from "@/lib/dates";
import type { CurrentUser } from "@/domain/auth/types";
import { nextAttendanceState, stateAfter } from "@/domain/attendance/state";
import { computeDayStatus } from "@/domain/attendance/status";
import { isAbandoned, openSince, summarise, type DaySummary } from "@/domain/attendance/summary";
import type { AttendanceState, DayStatus, EventKind, TimedEvent } from "@/domain/attendance/types";
import type { Settings } from "@/domain/settings/settings";
import type { Db, DbTx } from "@/server/db-types";
import { getSettings } from "@/server/settings";

export type DayContext = { settings: Settings; holidays: Map<string, string> };
type EventRow = { kind: string; at: Date; workDate: string };

/** Reads through `client`, so it is safe inside a transaction. */
export async function loadDayContext(client: Db = db): Promise<DayContext> {
  const [settings, holidays] = await Promise.all([getSettings(client), client.holiday.findMany()]);
  return { settings, holidays: new Map(holidays.map((h) => [h.date, h.name])) };
}

export const toTimed = (e: { kind: string; at: Date }): TimedEvent => ({ kind: e.kind as EventKind, at: e.at });

/**
 * One day's summary and status as of `now`. An open session younger than 16 hours is live (today);
 * an abandoned one counts nothing after its last event and ends up MISSING_CHECKOUT.
 */
export function evaluateDay(date: string, events: TimedEvent[], now: Date, ctx: DayContext): { summary: DaySummary; status: DayStatus } {
  const today = istDateKey(now);
  const last = events.at(-1);
  let summary = summarise(events, now);
  let live = false;
  if (summary.open && last) {
    if (isAbandoned(openSince(events) ?? last.at, now)) summary = summarise(events, last.at);
    else live = true;
  }
  const status = computeDayStatus({
    isWeekend: ctx.settings["work.weekendDays"].includes(weekdayOf(date)),
    holidayName: ctx.holidays.get(date) ?? null,
    leave: null,
    hasEvents: events.length > 0,
    open: summary.open,
    isPast: date < today && !live,
    isToday: date === today || live,
    workedMinutes: summary.workedMinutes,
    requiredMinutes: ctx.settings["attendance.requiredDailyMinutes"],
    halfDayMinutes: ctx.settings["attendance.halfDayMinutes"],
  });
  return { summary, status };
}

/** The day a new button press belongs to: a live open session's day, otherwise today. */
export async function currentDay(client: Db, employeeId: string, now: Date): Promise<{ workDate: string; events: EventRow[]; state: AttendanceState }> {
  const today = istDateKey(now);
  const last = await client.attendanceEvent.findFirst({ where: { employeeId }, orderBy: { at: "desc" } });
  if (last && last.workDate !== today) {
    const events = await client.attendanceEvent.findMany({ where: { employeeId, workDate: last.workDate }, orderBy: { at: "asc" } });
    const timed = events.map(toTimed);
    const state = stateAfter(timed);
    if ((state === "WORKING" || state === "ON_BREAK") && !isAbandoned(openSince(timed) ?? last.at, now)) return { workDate: last.workDate, events, state };
  }
  const events = await client.attendanceEvent.findMany({ where: { employeeId, workDate: today }, orderBy: { at: "asc" } });
  return { workDate: today, events, state: stateAfter(events.map(toTimed)) };
}

/** Rewrites the cached AttendanceDay row from that day's events. Returns the new status. */
export async function recomputeDay(tx: DbTx, employeeId: string, workDate: string, now: Date, ctx?: DayContext): Promise<DayStatus> {
  const context = ctx ?? (await loadDayContext(tx));
  const events = await tx.attendanceEvent.findMany({ where: { employeeId, workDate }, orderBy: { at: "asc" } });
  const { summary, status } = evaluateDay(workDate, events.map(toTimed), now, context);
  const data = {
    firstInAt: summary.firstInAt,
    lastOutAt: summary.lastOutAt,
    workedMinutes: summary.workedMinutes,
    breakMinutes: summary.breakMinutes,
    status,
  };
  await tx.attendanceDay.upsert({ where: { employeeId_workDate: { employeeId, workDate } }, create: { employeeId, workDate, ...data }, update: data });
  return status;
}

function refusal(state: AttendanceState, kind: EventKind): string {
  if (kind === "IN") return "You're already checked in.";
  if (kind === "BREAK_START") return state === "ON_BREAK" ? "You're already on a break." : "You aren't checked in.";
  if (kind === "BREAK_END") return "You're not on a break.";
  return "You aren't checked in.";
}

export type RecordResult = { ok: true; state: AttendanceState; workDate: string } | { ok: false; error: string };

/** Check in / break / back / check out. The transaction re-reads the latest event, so duplicates are refused. */
export function recordAttendance(actor: CurrentUser, kind: EventKind, now = new Date()): Promise<RecordResult> {
  return db.$transaction(async (tx): Promise<RecordResult> => {
    const day = await currentDay(tx, actor.employeeId, now);
    const next = nextAttendanceState(day.state, kind);
    if (!next) return { ok: false, error: refusal(day.state, kind) };
    await tx.attendanceEvent.create({ data: { employeeId: actor.employeeId, workDate: day.workDate, at: now, kind, source: "WEB" } });
    await recomputeDay(tx, actor.employeeId, day.workDate, now);
    return { ok: true, state: next, workDate: day.workDate };
  });
}

/** Yesterday in IST, for the nightly job. */
export const yesterdayOf = (now: Date) => addDays(istDateKey(now), -1);
