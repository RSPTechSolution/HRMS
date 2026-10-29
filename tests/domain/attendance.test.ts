import { describe, expect, it } from "vitest";
import { nextAttendanceState, stateAfter } from "@/domain/attendance/state";
import { isAbandoned, summarise } from "@/domain/attendance/summary";
import { computeDayStatus } from "@/domain/attendance/status";
import type { EventKind, TimedEvent } from "@/domain/attendance/types";

const at = (hhmm: string, day = "2026-10-28") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h, m) - 330 * 60_000);
};
const ev = (kind: EventKind, hhmm: string): TimedEvent => ({ kind, at: at(hhmm) });

describe("attendance state machine", () => {
  it.each([
    ["NOT_STARTED", "IN", "WORKING"],
    ["WORKING", "BREAK_START", "ON_BREAK"],
    ["ON_BREAK", "BREAK_END", "WORKING"],
    ["WORKING", "OUT", "CHECKED_OUT"],
    ["ON_BREAK", "OUT", "CHECKED_OUT"],
    ["CHECKED_OUT", "IN", "WORKING"],
  ] as const)("%s + %s → %s", (from, kind, to) => {
    expect(nextAttendanceState(from, kind)).toBe(to);
  });
  it.each([
    ["CHECKED_OUT", "OUT"],
    ["NOT_STARTED", "BREAK_START"],
    ["WORKING", "IN"],
    ["NOT_STARTED", "OUT"],
    ["ON_BREAK", "BREAK_START"],
  ] as const)("refuses %s + %s", (from, kind) => {
    expect(nextAttendanceState(from, kind)).toBeNull();
  });
  it("derives the state from events", () => {
    expect(stateAfter([])).toBe("NOT_STARTED");
    expect(stateAfter([ev("IN", "09:30"), ev("BREAK_START", "13:00")])).toBe("ON_BREAK");
  });
});

describe("summarise", () => {
  it("counts work minus breaks", () => {
    const s = summarise([ev("IN", "09:30"), ev("BREAK_START", "13:00"), ev("BREAK_END", "13:30"), ev("OUT", "18:45")], at("23:00"));
    expect(s).toEqual({ firstInAt: at("09:30"), lastOutAt: at("18:45"), workedMinutes: 525, breakMinutes: 30, open: false });
  });
  it("adds a second session", () => {
    const s = summarise([ev("IN", "09:30"), ev("BREAK_START", "13:00"), ev("BREAK_END", "13:30"), ev("OUT", "18:45"), ev("IN", "20:00"), ev("OUT", "21:00")], at("23:00"));
    expect(s.workedMinutes).toBe(585);
  });
  it("counts an open session up to now", () => {
    expect(summarise([ev("IN", "09:00")], at("11:00"))).toMatchObject({ workedMinutes: 120, open: true, lastOutAt: null });
  });
  it("ends a break when someone checks out during it", () => {
    expect(summarise([ev("IN", "09:00"), ev("BREAK_START", "17:00"), ev("OUT", "17:30")], at("23:00"))).toMatchObject({ workedMinutes: 480, breakMinutes: 30, open: false });
  });
  it("treats a session open for more than 16 hours as abandoned", () => {
    const last = new Date("2026-10-28T04:00:00Z");
    expect(isAbandoned(last, new Date(last.getTime() + (16 * 60 + 1) * 60_000))).toBe(true);
    expect(isAbandoned(last, new Date(last.getTime() + (15 * 60 + 59) * 60_000))).toBe(false);
  });
});

describe("computeDayStatus", () => {
  const base = { isWeekend: false, holidayName: null, leave: null, hasEvents: true, open: false, isPast: true, isToday: false, workedMinutes: 540, requiredMinutes: 540, halfDayMinutes: 270 } as const;
  it.each([
    [{ holidayName: "Diwali", leave: "FULL" as const }, "HOLIDAY"],
    [{ isWeekend: true }, "WEEKEND"],
    [{ leave: "FULL" as const }, "LEAVE"],
    [{ isPast: false, isToday: true, hasEvents: false, workedMinutes: 0 }, "IN_PROGRESS"],
    [{ isPast: false, isToday: true, open: true, workedMinutes: 100 }, "IN_PROGRESS"],
    [{ isPast: false, isToday: false, hasEvents: false, workedMinutes: 0 }, "UPCOMING"],
    [{ open: true, workedMinutes: 100 }, "MISSING_CHECKOUT"],
    [{}, "PRESENT"],
    [{ workedMinutes: 539 }, "SHORT"],
    [{ workedMinutes: 270 }, "SHORT"],
    [{ workedMinutes: 269 }, "HALF_DAY"],
    [{ hasEvents: false, workedMinutes: 0 }, "ABSENT"],
    [{ leave: "HALF" as const, workedMinutes: 270 }, "PRESENT"],
  ])("%o → %s", (over, expected) => {
    expect(computeDayStatus({ ...base, ...over })).toBe(expected);
  });
});
