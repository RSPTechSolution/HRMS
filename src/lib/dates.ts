/** IST is a fixed +05:30 offset (no daylight saving), so plain arithmetic is exact. */
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

function keyFromUtcMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function utcMsFromKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Calendar date (YYYY-MM-DD) of an instant in IST. */
export function istDateKey(d: Date): string {
  return keyFromUtcMs(d.getTime() + IST_OFFSET_MS);
}

/** Wall-clock time (HH:MM) of an instant in IST. */
export function istTimeLabel(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** True only for a real calendar date in YYYY-MM-DD form ("2026-02-30" and "2026-10-99" are false). */
export function isRealDate(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && keyFromUtcMs(utcMsFromKey(key)) === key;
}

export function addDays(key: string, n: number): string {
  return keyFromUtcMs(utcMsFromKey(key) + n * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: string): number {
  return new Date(utcMsFromKey(key)).getUTCDay();
}

/** Every calendar date of a month (month is 1–12). */
export function daysOfMonth(year: number, month: number): string[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

/** Month arithmetic: shiftMonth(2026, 1, -1) → { year: 2025, month: 12 }. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "October 2026" */
export const monthLabel = (m: { year: number; month: number }) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;

/** "2026-10" */
export const monthKey = (m: { year: number; month: number }) => `${m.year}-${pad(m.month)}`;

/** Parses "YYYY-MM"; null when malformed. */
export function parseMonthKey(value: string | undefined | null): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

export function monthOf(key: string): { year: number; month: number } {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

/** The instant at 00:00 IST on the given date. */
export function istStartOfDay(key: string): Date {
  return new Date(utcMsFromKey(key) - IST_OFFSET_MS);
}

/** The instant for an IST wall-clock time ("HH:MM") on the given date. */
export function istDateTime(key: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(istStartOfDay(key).getTime() + (h * 60 + m) * 60 * 1000);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 28 Oct" */
export function dayLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(key)]} ${d} ${MONTHS[m - 1]}`;
}

/** Whole minutes from a to b (floored). */
export function minutesBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}
