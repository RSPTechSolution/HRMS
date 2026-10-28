import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import {
  isSettingKey,
  SETTINGS_DEFAULTS,
  SETTINGS_SCHEMA,
  validateSettingChange,
  type SettingKey,
  type Settings,
} from "@/domain/settings/settings";
import { writeAudit } from "./audit";

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out: Settings = { ...SETTINGS_DEFAULTS };
  for (const row of rows) {
    if (!isSettingKey(row.key)) continue;
    let value: unknown;
    try {
      value = JSON.parse(row.value);
    } catch {
      continue;
    }
    const parsed = (SETTINGS_SCHEMA[row.key] as z.ZodType).safeParse(value);
    if (parsed.success) (out as Record<string, unknown>)[row.key] = parsed.data;
  }
  return out;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

export async function updateSetting(actor: CurrentUser, key: SettingKey, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "settings.manage")) return { ok: false, error: "Only admins can change settings." };
  const current = await getSettings();
  const result = validateSettingChange(current, key, raw);
  if (!result.ok) return result;
  const value = JSON.stringify(result.value);
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await writeAudit(tx, { actorId: actor.userId, action: "settings.update", entityType: "Setting", entityId: key, before: current[key], after: result.value });
  });
  return { ok: true };
}
