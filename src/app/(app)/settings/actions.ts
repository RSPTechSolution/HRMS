"use server";
import { revalidatePath } from "next/cache";
import { isSettingKey, parseSettingInput } from "@/domain/settings/settings";
import { requireUser } from "@/server/auth/current-user";
import { updateSetting } from "@/server/settings";

export type SettingFormState = { error?: string; savedAt?: number } | undefined;

export async function updateSettingAction(_prev: SettingFormState, formData: FormData): Promise<SettingFormState> {
  const user = await requireUser();
  const key = String(formData.get("key") ?? "");
  if (!isSettingKey(key)) return { error: "Unknown setting." };
  const result = await updateSetting(user, key, parseSettingInput(key, formData.getAll("value").map(String)));
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}
