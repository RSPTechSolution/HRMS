import "server-only";
import { istDateKey, monthOf } from "@/lib/dates";

/** Today in IST. Lives on the server so components never call new Date() while rendering. */
export function todayKey(): string {
  return istDateKey(new Date());
}

export function currentMonth(): { year: number; month: number } {
  return monthOf(todayKey());
}
