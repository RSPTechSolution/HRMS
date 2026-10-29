import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getSetting, getSettings, updateSetting } from "@/server/settings";
import { loadCurrentUser } from "@/server/auth/users";
import { SETTINGS_DEFAULTS } from "@/domain/settings/settings";
import { makeEmployee, resetDb } from "../helpers/db";

describe("settings service", () => {
  beforeEach(resetDb);

  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual(SETTINGS_DEFAULTS);
  });

  it("lets admins update a setting and audits it", async () => {
    const { user } = await makeEmployee({ isAdmin: true });
    const admin = (await loadCurrentUser(user.id))!;
    expect(await updateSetting(admin, "attendance.requiredDailyMinutes", 480)).toEqual({ ok: true });
    expect(await getSetting("attendance.requiredDailyMinutes")).toBe(480);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: "attendance.requiredDailyMinutes" } });
    expect(audit).toMatchObject({ actorId: user.id, action: "settings.update", before: "540", after: "480" });
  });

  it("refuses non-admins", async () => {
    const { user } = await makeEmployee({ isHR: true });
    const hr = (await loadCurrentUser(user.id))!;
    expect(await updateSetting(hr, "company.name", "X Corp")).toEqual({ ok: false, error: "Only admins can change settings." });
    expect(await getSetting("company.name")).toBe("LN Webworks");
  });

  it("falls back to both attendance defaults when the stored pair is inconsistent", async () => {
    await db.setting.create({ data: { key: "attendance.halfDayMinutes", value: "600" } });
    await db.setting.create({ data: { key: "attendance.requiredDailyMinutes", value: "{corrupt" } });
    const s = await getSettings();
    expect(s["attendance.requiredDailyMinutes"]).toBe(540);
    expect(s["attendance.halfDayMinutes"]).toBe(270);
  });

  it("falls back to the default when a stored value is corrupt or invalid", async () => {
    await db.setting.create({ data: { key: "attendance.requiredDailyMinutes", value: "{not json" } });
    await db.setting.create({ data: { key: "attendance.halfDayMinutes", value: JSON.stringify("ten") } });
    await db.setting.create({ data: { key: "retired.key", value: "1" } });
    const s = await getSettings();
    expect(s["attendance.requiredDailyMinutes"]).toBe(540);
    expect(s["attendance.halfDayMinutes"]).toBe(270);
  });
});
