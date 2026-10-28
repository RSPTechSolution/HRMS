import { z } from "zod";

export const SETTINGS_SCHEMA = {
  "company.name": z.string().trim().min(1, "Enter a company name.").max(80),
  "company.timezone": z.literal("Asia/Kolkata"),
  "work.weekendDays": z.array(z.number().int().min(0).max(6)).max(6, "At least one day must be a working day."),
  "attendance.requiredDailyMinutes": z.number().int().min(60).max(960),
  "attendance.halfDayMinutes": z.number().int().min(30).max(720),
  "attendance.correctionWindowDays": z.number().int().min(1).max(90),
  "leave.backdateWindowDays": z.number().int().min(0).max(90),
  "wfh.monthlyLimit": z.number().int().min(1).max(31).nullable(),
  "offboarding.defaultNoticeDays": z.number().int().min(0).max(180),
};

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };
export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

export const SETTINGS_DEFAULTS: Settings = {
  "company.name": "LN Webworks",
  "company.timezone": "Asia/Kolkata",
  "work.weekendDays": [0, 6],
  "attendance.requiredDailyMinutes": 540,
  "attendance.halfDayMinutes": 270,
  "attendance.correctionWindowDays": 30,
  "leave.backdateWindowDays": 30,
  "wfh.monthlyLimit": null,
  "offboarding.defaultNoticeDays": 60,
};

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS_SCHEMA, key);
}

export type SettingInputKind = "text" | "number" | "nullable-number" | "weekdays" | "readonly";

export const SETTING_META: Record<SettingKey, { label: string; help: string; kind: SettingInputKind }> = {
  "company.name": { label: "Company name", help: "Shown in emails and page titles.", kind: "text" },
  "company.timezone": { label: "Timezone", help: "All dates and times use Indian Standard Time.", kind: "readonly" },
  "work.weekendDays": { label: "Weekend days", help: "Days nobody is expected to work.", kind: "weekdays" },
  "attendance.requiredDailyMinutes": { label: "Full day (minutes)", help: "Working time for a full day, breaks excluded. 540 = 9 hours.", kind: "number" },
  "attendance.halfDayMinutes": { label: "Half day below (minutes)", help: "Days shorter than this count as half days.", kind: "number" },
  "attendance.correctionWindowDays": { label: "Correction window (days)", help: "How far back people can ask to fix attendance.", kind: "number" },
  "leave.backdateWindowDays": { label: "Backdated leave window (days)", help: "How far back leave types that allow it can be applied.", kind: "number" },
  "wfh.monthlyLimit": { label: "WFH days per month", help: "Leave empty for no limit.", kind: "nullable-number" },
  "offboarding.defaultNoticeDays": { label: "Notice period (days)", help: "Default notice period after a resignation.", kind: "number" },
};

export function parseSettingInput(key: SettingKey, values: string[]): unknown {
  const first = values[0] ?? "";
  switch (SETTING_META[key].kind) {
    case "text":
      return first;
    case "number":
      return first.trim() === "" ? Number.NaN : Number(first);
    case "nullable-number":
      return first.trim() === "" ? null : Number(first);
    case "weekdays":
      return [...new Set(values.map(Number))].sort((a, b) => a - b);
    case "readonly":
      return undefined;
  }
}

export type ChangeResult<K extends SettingKey> = { ok: true; value: Settings[K] } | { ok: false; error: string };

export function validateSettingChange<K extends SettingKey>(current: Settings, key: K, raw: unknown): ChangeResult<K> {
  if (SETTING_META[key].kind === "readonly") return { ok: false, error: "This setting can't be changed." };
  const parsed = (SETTINGS_SCHEMA[key] as z.ZodType).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That value isn't valid." };
  const next = { ...current, [key]: parsed.data } as Settings;
  if (next["attendance.halfDayMinutes"] >= next["attendance.requiredDailyMinutes"]) {
    return { ok: false, error: "The half-day threshold must be shorter than the full day." };
  }
  return { ok: true, value: parsed.data as Settings[K] };
}
