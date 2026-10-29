import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { istDateTime } from "@/lib/dates";
import { loadCurrentUser } from "@/server/auth/users";
import { recordAttendance } from "@/server/attendance/record";
import { getMonth, getRecentHours, getToday, todayStateMap } from "@/server/attendance/views";
import { getTeamToday } from "@/server/attendance/team";
import { closeAttendanceDay } from "@/server/attendance/close-day";
import { getDirectory } from "@/server/people/directory";
import { makeEmployee, resetDb } from "../helpers/db";

const at = (day: string, hhmm: string) => istDateTime(day, hhmm);

async function org() {
  const hr = await makeEmployee({ name: "Neha Verma", isHR: true });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const engineer = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const second = await makeEmployee({ name: "Karan Joshi", managerId: manager.employee.id });
  const colleague = await makeEmployee({ name: "Riya Kapoor" });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  return { hr, manager, engineer, second, colleague, me };
}

describe("recording attendance", () => {
  beforeEach(resetDb);

  it("records a full day with a break and lets people check in again", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    const day = "2026-10-28";
    expect(await recordAttendance(u, "IN", at(day, "09:30"))).toEqual({ ok: true, state: "WORKING", workDate: day });
    expect((await recordAttendance(u, "BREAK_START", at(day, "13:00"))).ok).toBe(true);
    expect((await recordAttendance(u, "BREAK_END", at(day, "13:30"))).ok).toBe(true);
    expect(await recordAttendance(u, "OUT", at(day, "18:45"))).toEqual({ ok: true, state: "CHECKED_OUT", workDate: day });
    const row = await db.attendanceDay.findUniqueOrThrow({ where: { employeeId_workDate: { employeeId: engineer.employee.id, workDate: day } } });
    expect(row).toMatchObject({ workedMinutes: 525, breakMinutes: 30, status: "SHORT" });
    expect((await recordAttendance(u, "IN", at(day, "19:00"))).ok).toBe(true);
    expect(await db.attendanceEvent.count({ where: { employeeId: engineer.employee.id } })).toBe(5);
  });

  it("ignores double clicks and buttons that make no sense", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    const day = "2026-10-28";
    await recordAttendance(u, "IN", at(day, "09:30"));
    expect(await recordAttendance(u, "IN", at(day, "09:31"))).toEqual({ ok: false, error: "You're already checked in." });
    await recordAttendance(u, "OUT", at(day, "18:30"));
    expect(await recordAttendance(u, "BREAK_START", at(day, "18:40"))).toEqual({ ok: false, error: "You aren't checked in." });
    expect(await db.attendanceEvent.count({ where: { employeeId: engineer.employee.id } })).toBe(2);
  });

  it("writes one check-in when two arrive at the same moment", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    const results = await Promise.all([recordAttendance(u, "IN", at("2026-10-28", "09:30")), recordAttendance(u, "IN", at("2026-10-28", "09:30"))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.attendanceEvent.count({ where: { employeeId: engineer.employee.id, kind: "IN" } })).toBe(1);
  });

  it("keeps a session that crosses midnight on the day it started", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    await recordAttendance(u, "IN", at("2026-10-28", "23:00"));
    expect(await recordAttendance(u, "OUT", at("2026-10-29", "01:00"))).toEqual({ ok: true, state: "CHECKED_OUT", workDate: "2026-10-28" });
    const row = await db.attendanceDay.findUniqueOrThrow({ where: { employeeId_workDate: { employeeId: engineer.employee.id, workDate: "2026-10-28" } } });
    expect(row.workedMinutes).toBe(120);
  });

  it("starts a fresh day after a forgotten check-out, and the nightly close flags it once", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    await recordAttendance(u, "IN", at("2026-10-28", "09:30"));
    expect(await recordAttendance(u, "IN", at("2026-10-30", "09:30"))).toEqual({ ok: true, state: "WORKING", workDate: "2026-10-30" });

    const now = at("2026-10-30", "10:00");
    await closeAttendanceDay("2026-10-28", now);
    const row = await db.attendanceDay.findUniqueOrThrow({ where: { employeeId_workDate: { employeeId: engineer.employee.id, workDate: "2026-10-28" } } });
    expect(row.status).toBe("MISSING_CHECKOUT");
    await closeAttendanceDay("2026-10-28", now);
    expect(await db.notification.count({ where: { userId: engineer.user.id, kind: "attendance.missing_checkout" } })).toBe(1);
  });

  it("marks absences once when closing a day with no attendance", async () => {
    const { engineer } = await org();
    const now = at("2026-10-28", "00:30");
    await closeAttendanceDay("2026-10-27", now);
    await closeAttendanceDay("2026-10-27", now);
    expect(await db.notification.count({ where: { userId: engineer.user.id, kind: "attendance.absent" } })).toBe(1);
  });
});

describe("attendance views", () => {
  beforeEach(resetDb);

  it("builds the month with holidays, weekends, absences, today and upcoming days", async () => {
    const { engineer, me } = await org();
    await db.holiday.create({ data: { date: "2026-10-02", name: "Gandhi Jayanti" } });
    const u = await me(engineer);
    await recordAttendance(u, "IN", at("2026-10-26", "09:30"));
    await recordAttendance(u, "OUT", at("2026-10-26", "18:45"));
    const result = await getMonth(u, engineer.employee.id, 2026, 10, at("2026-10-28", "12:00"));
    if (!result.ok) throw new Error(result.error);
    const byDate = new Map(result.days.map((d) => [d.date, d]));
    expect(result.days).toHaveLength(31);
    expect(byDate.get("2026-10-02")).toMatchObject({ status: "HOLIDAY", holidayName: "Gandhi Jayanti" });
    expect(byDate.get("2026-10-03")?.status).toBe("WEEKEND");
    expect(byDate.get("2026-10-26")).toMatchObject({ status: "PRESENT", workedMinutes: 555, firstIn: "09:30", lastOut: "18:45" });
    expect(byDate.get("2026-10-27")?.status).toBe("ABSENT");
    expect(byDate.get("2026-10-28")?.status).toBe("IN_PROGRESS");
    expect(byDate.get("2026-10-29")?.status).toBe("UPCOMING");
    expect(result.stats.fullDays).toBe(1);
    expect(result.stats.averageMinutes).toBe(555);
  });

  it("only shows attendance to the person, their managers and HR", async () => {
    const { hr, manager, engineer, colleague, me } = await org();
    const now = at("2026-10-28", "12:00");
    expect((await getMonth(await me(manager), engineer.employee.id, 2026, 10, now)).ok).toBe(true);
    expect((await getMonth(await me(hr), engineer.employee.id, 2026, 10, now)).ok).toBe(true);
    expect(await getMonth(await me(colleague), engineer.employee.id, 2026, 10, now)).toEqual({ ok: false, error: "You can't see this person's attendance." });
  });

  it("shows today's live state and the last ten working days", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    await recordAttendance(u, "IN", at("2026-10-28", "09:30"));
    const today = await getToday(engineer.employee.id, at("2026-10-28", "11:00"));
    expect(today).toMatchObject({ workDate: "2026-10-28", state: "WORKING", workedMinutes: 90, requiredMinutes: 540 });
    expect(today.events.map((e) => [e.kind, e.time])).toEqual([["IN", "09:30"]]);

    const recent = await getRecentHours(engineer.employee.id, at("2026-10-28", "11:00"));
    expect(recent).toHaveLength(10);
    expect(recent.at(-1)).toMatchObject({ date: "2026-10-28", today: true, minutes: 90 });
    expect(recent.some((d) => d.date === "2026-10-24" || d.date === "2026-10-25")).toBe(false);
  });

  it("gives managers a team board and the directory a live status", async () => {
    const { manager, engineer, colleague, me } = await org();
    const now = at("2026-10-28", "11:00");
    await recordAttendance(await me(engineer), "IN", at("2026-10-28", "09:30"));
    const team = await getTeamToday(await me(manager), now);
    expect(team?.counts).toEqual({ in: 1, onBreak: 0, out: 0, notIn: 1 });
    expect(team?.people.find((p) => p.id === engineer.employee.id)).toMatchObject({ state: "IN", since: "09:30" });
    expect(await getTeamToday(await me(colleague), now)).toBeNull();

    const dir = await getDirectory(await me(colleague), {}, (ids) => todayStateMap(ids, now));
    expect(dir.find((d) => d.id === engineer.employee.id)?.today).toBe("IN");
    expect(dir.find((d) => d.id === colleague.employee.id)?.today).toBe("NOT_IN");
  });
});
