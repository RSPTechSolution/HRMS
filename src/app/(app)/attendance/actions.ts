"use server";
import { revalidatePath } from "next/cache";
import "@/server/approvals/types";
import type { EventKind } from "@/domain/attendance/types";
import { requireUser } from "@/server/auth/current-user";
import { closeAttendanceDay } from "@/server/attendance/close-day";
import { requestCorrection } from "@/server/attendance/corrections";
import { recordAttendance, yesterdayOf } from "@/server/attendance/record";

const KINDS: EventKind[] = ["IN", "OUT", "BREAK_START", "BREAK_END"];

export async function checkAction(kind: EventKind): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!KINDS.includes(kind)) return { ok: false, error: "That isn't an attendance action." };
  const result = await recordAttendance(user, kind);
  revalidatePath("/", "layout");
  return result.ok ? { ok: true } : result;
}

export type CorrectionFormState = { error?: string; sentAt?: number } | undefined;

export async function requestCorrectionAction(_prev: CorrectionFormState, fd: FormData): Promise<CorrectionFormState> {
  const user = await requireUser();
  const result = await requestCorrection(user, Object.fromEntries(fd.entries()));
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { sentAt: Date.now() };
}

export async function runCloseDayAction(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, error: "Only admins can run jobs." };
  const day = yesterdayOf(new Date());
  const { missingCheckout, absent } = await closeAttendanceDay(day);
  return { ok: true, message: `Closed ${day}: ${missingCheckout} missed check-out(s), ${absent} absence(s).` };
}
