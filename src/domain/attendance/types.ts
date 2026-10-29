export type EventKind = "IN" | "OUT" | "BREAK_START" | "BREAK_END";
export type EventSource = "WEB" | "CORRECTION" | "SYSTEM";
export type AttendanceState = "NOT_STARTED" | "WORKING" | "ON_BREAK" | "CHECKED_OUT";
export type DayStatus =
  | "PRESENT"
  | "SHORT"
  | "HALF_DAY"
  | "ABSENT"
  | "MISSING_CHECKOUT"
  | "IN_PROGRESS"
  | "HOLIDAY"
  | "WEEKEND"
  | "LEAVE"
  | "UPCOMING";
export type TimedEvent = { kind: EventKind; at: Date };

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  PRESENT: "Full day",
  SHORT: "Short day",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  MISSING_CHECKOUT: "Missed check-out",
  IN_PROGRESS: "Today",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekend",
  LEAVE: "On leave",
  UPCOMING: "Upcoming",
};
