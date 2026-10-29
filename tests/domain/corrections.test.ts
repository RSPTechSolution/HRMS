import { describe, expect, it } from "vitest";
import { correctionInputSchema, validateCorrection } from "@/domain/attendance/corrections";

const ctx = { today: "2026-10-28", windowDays: 30, hasOpenCorrection: false };
const input = (over: Record<string, unknown> = {}) =>
  correctionInputSchema.parse({ workDate: "2026-10-14", inTime: "09:30", outTime: "18:30", breakStart: "", breakEnd: "", reason: "Forgot to check in", ...over });

describe("correction input", () => {
  it("requires a reason and proper times", () => {
    expect(correctionInputSchema.safeParse({ workDate: "2026-10-14", inTime: "9:30", outTime: "18:30", reason: "Forgot" }).success).toBe(false);
    expect(correctionInputSchema.safeParse({ workDate: "2026-10-14", inTime: "09:30", outTime: "18:30", reason: "oops" }).success).toBe(false);
  });
});

describe("validateCorrection", () => {
  it("turns IST times into instants", () => {
    const r = validateCorrection(input({ breakStart: "13:00", breakEnd: "13:30" }), ctx);
    expect(r).toEqual({
      ok: true,
      inAt: new Date("2026-10-14T04:00:00.000Z"),
      outAt: new Date("2026-10-14T13:00:00.000Z"),
      breakStartAt: new Date("2026-10-14T07:30:00.000Z"),
      breakEndAt: new Date("2026-10-14T08:00:00.000Z"),
    });
  });
  it.each([
    [{ workDate: "2026-10-28" }, ctx, "Pick a day before today."],
    [{ workDate: "2026-10-30" }, ctx, "Pick a day before today."],
    [{ workDate: "2026-09-27" }, ctx, "Corrections are only possible for the last 30 days."],
    [{ outTime: "09:30" }, ctx, "Check-out must be after check-in."],
    [{ outTime: "08:00" }, ctx, "Check-out must be after check-in."],
    [{ breakStart: "13:00" }, ctx, "Give both break times or neither."],
    [{ breakStart: "08:00", breakEnd: "08:30" }, ctx, "The break must sit inside the working hours."],
    [{ breakStart: "14:00", breakEnd: "13:30" }, ctx, "The break must sit inside the working hours."],
    [{}, { ...ctx, hasOpenCorrection: true }, "There's already a correction waiting for that day."],
  ])("refuses %o", (over, c, error) => {
    expect(validateCorrection(input(over), c)).toEqual({ ok: false, error });
  });
  it("accepts the oldest day inside the window", () => {
    expect(validateCorrection(input({ workDate: "2026-09-28" }), ctx).ok).toBe(true);
  });
});
