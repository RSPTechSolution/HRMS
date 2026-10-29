import type { AttendanceState, EventKind, TimedEvent } from "./types";

const TRANSITIONS: Record<AttendanceState, Partial<Record<EventKind, AttendanceState>>> = {
  NOT_STARTED: { IN: "WORKING" },
  WORKING: { BREAK_START: "ON_BREAK", OUT: "CHECKED_OUT" },
  ON_BREAK: { BREAK_END: "WORKING", OUT: "CHECKED_OUT" },
  CHECKED_OUT: { IN: "WORKING" },
};

/** The state after `kind`, or null when that button makes no sense right now. */
export function nextAttendanceState(state: AttendanceState, kind: EventKind): AttendanceState | null {
  return TRANSITIONS[state][kind] ?? null;
}

/** State after replaying events in time order; invalid events are ignored. */
export function stateAfter(events: TimedEvent[]): AttendanceState {
  let state: AttendanceState = "NOT_STARTED";
  for (const e of events) state = nextAttendanceState(state, e.kind) ?? state;
  return state;
}
