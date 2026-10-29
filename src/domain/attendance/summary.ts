import { nextAttendanceState } from "./state";
import type { AttendanceState, TimedEvent } from "./types";

export const OPEN_SESSION_MAX_MINUTES = 960;

export type DaySummary = { firstInAt: Date | null; lastOutAt: Date | null; workedMinutes: number; breakMinutes: number; open: boolean };

/**
 * Worked time = time between IN and OUT minus breaks. An open session (or break) runs until `until`.
 * Events the state machine rejects are skipped, so bad data can never produce negative time.
 */
export function summarise(events: TimedEvent[], until: Date): DaySummary {
  let state: AttendanceState = "NOT_STARTED";
  let presenceMs = 0;
  let breakMs = 0;
  let sessionStart: Date | null = null;
  let breakStart: Date | null = null;
  let firstInAt: Date | null = null;
  let lastOutAt: Date | null = null;

  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const next = nextAttendanceState(state, e.kind);
    if (!next) continue;
    if (e.kind === "IN") {
      sessionStart = e.at;
      firstInAt ??= e.at;
    } else if (e.kind === "BREAK_START") {
      breakStart = e.at;
    } else if (e.kind === "BREAK_END" && breakStart) {
      breakMs += e.at.getTime() - breakStart.getTime();
      breakStart = null;
    } else if (e.kind === "OUT" && sessionStart) {
      if (breakStart) breakMs += e.at.getTime() - breakStart.getTime();
      presenceMs += e.at.getTime() - sessionStart.getTime();
      sessionStart = null;
      breakStart = null;
      lastOutAt = e.at;
    }
    state = next;
  }

  const open = state === "WORKING" || state === "ON_BREAK";
  if (open && sessionStart) {
    presenceMs += Math.max(0, until.getTime() - sessionStart.getTime());
    if (breakStart) breakMs += Math.max(0, until.getTime() - breakStart.getTime());
  }
  const breakMinutes = Math.floor(breakMs / 60000);
  return {
    firstInAt,
    lastOutAt: open ? null : lastOutAt,
    workedMinutes: Math.max(0, Math.floor(presenceMs / 60000) - breakMinutes),
    breakMinutes,
    open,
  };
}

/** A session nobody closed for 16 hours is treated as forgotten. */
export function isAbandoned(lastEventAt: Date, now: Date): boolean {
  return now.getTime() - lastEventAt.getTime() > OPEN_SESSION_MAX_MINUTES * 60000;
}
