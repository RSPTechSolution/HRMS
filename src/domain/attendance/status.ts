import type { DayStatus } from "./types";

export type DayStatusInput = {
  isWeekend: boolean;
  holidayName: string | null;
  leave: "FULL" | "HALF" | null;
  hasEvents: boolean;
  open: boolean;
  isPast: boolean;
  isToday: boolean;
  workedMinutes: number;
  requiredMinutes: number;
  halfDayMinutes: number;
};

/** Spec §6.3, in priority order. Half-day leave halves the minutes needed for a full day. */
export function computeDayStatus(i: DayStatusInput): DayStatus {
  if (i.holidayName) return "HOLIDAY";
  if (i.isWeekend) return "WEEKEND";
  if (i.leave === "FULL") return "LEAVE";
  if (i.isToday && (i.open || !i.hasEvents)) return "IN_PROGRESS";
  if (!i.isPast && !i.isToday) return "UPCOMING";
  if (i.open) return "MISSING_CHECKOUT";
  const required = i.leave === "HALF" ? Math.floor(i.requiredMinutes / 2) : i.requiredMinutes;
  if (i.workedMinutes >= required) return "PRESENT";
  if (i.workedMinutes >= i.halfDayMinutes) return "SHORT";
  if (i.workedMinutes > 0) return "HALF_DAY";
  return "ABSENT";
}
