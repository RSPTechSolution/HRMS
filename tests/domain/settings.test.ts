import { describe, expect, it } from "vitest";
import { isSettingKey, parseSettingInput, SETTINGS_DEFAULTS, validateSettingChange } from "@/domain/settings/settings";

describe("settings rules", () => {
  it("knows its keys", () => {
    expect(isSettingKey("company.name")).toBe(true);
    expect(isSettingKey("toString")).toBe(false);
    expect(isSettingKey("nope")).toBe(false);
  });

  it("parses form input by kind", () => {
    expect(parseSettingInput("company.name", ["LN Webworks"])).toBe("LN Webworks");
    expect(parseSettingInput("attendance.requiredDailyMinutes", ["480"])).toBe(480);
    expect(Number.isNaN(parseSettingInput("attendance.requiredDailyMinutes", [""]))).toBe(true);
    expect(parseSettingInput("wfh.monthlyLimit", [""])).toBeNull();
    expect(parseSettingInput("wfh.monthlyLimit", ["4"])).toBe(4);
    expect(parseSettingInput("work.weekendDays", ["6", "0", "6"])).toEqual([0, 6]);
  });

  it("accepts valid changes", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", 480)).toEqual({ ok: true, value: 480 });
    expect(validateSettingChange(SETTINGS_DEFAULTS, "company.name", "  LN Webworks Pvt Ltd ")).toEqual({ ok: true, value: "LN Webworks Pvt Ltd" });
  });

  it("rejects out-of-range or wrong-type values", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", 5000).ok).toBe(false);
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", Number.NaN).ok).toBe(false);
    expect(validateSettingChange(SETTINGS_DEFAULTS, "company.name", "   ").ok).toBe(false);
  });

  it("refuses read-only settings", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "company.timezone", "Asia/Kolkata")).toEqual({ ok: false, error: "This setting can't be changed." });
  });

  it("keeps the half-day threshold below the full day", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.halfDayMinutes", 540)).toEqual({
      ok: false,
      error: "The half-day threshold must be shorter than the full day.",
    });
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", 270).ok).toBe(false);
  });
});
