import { describe, expect, it } from "vitest";
import { addDays, dayLabel, daysOfMonth, istDateKey, istDateTime, istStartOfDay, istTimeLabel, minutesBetween, monthOf, weekdayOf } from "@/lib/dates";

describe("IST dates", () => {
  it("uses the IST calendar day, not UTC", () => {
    expect(istDateKey(new Date("2026-10-28T18:29:00Z"))).toBe("2026-10-28"); // 23:59 IST
    expect(istDateKey(new Date("2026-10-28T18:31:00Z"))).toBe("2026-10-29"); // 00:01 IST
  });
  it("formats IST clock times", () => {
    expect(istTimeLabel(new Date("2026-10-28T04:12:00Z"))).toBe("09:42");
  });
  it("does calendar arithmetic across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(weekdayOf("2026-10-28")).toBe(3);
    expect(daysOfMonth(2026, 2)).toHaveLength(28);
    expect(daysOfMonth(2026, 10)[0]).toBe("2026-10-01");
    expect(monthOf("2026-10-28")).toEqual({ year: 2026, month: 10 });
    expect(dayLabel("2026-10-28")).toBe("Wed 28 Oct");
  });
  it("converts IST wall-clock times to instants", () => {
    expect(istStartOfDay("2026-10-28").toISOString()).toBe("2026-10-27T18:30:00.000Z");
    expect(istDateTime("2026-10-28", "09:30").toISOString()).toBe("2026-10-28T04:00:00.000Z");
    expect(minutesBetween(new Date("2026-10-28T04:00:00Z"), new Date("2026-10-28T13:00:59Z"))).toBe(540);
  });
});
