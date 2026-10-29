"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toaster";
import { checkAction } from "@/app/(app)/attendance/actions";
import { istTimeLabel } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import type { EventKind } from "@/domain/attendance/types";
import type { TodayView } from "@/server/attendance/views";

const pad = (n: number) => String(n).padStart(2, "0");
const STATE_LABEL = { NOT_STARTED: "Not checked in", WORKING: "Working", ON_BREAK: "On a break", CHECKED_OUT: "Checked out" } as const;
const DONE_MESSAGE: Record<EventKind, string> = { IN: "Checked in. Have a good one!", BREAK_START: "Enjoy your break", BREAK_END: "Welcome back", OUT: "Checked out. See you tomorrow!" };
const istClock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" });

export function ClockCard({ today }: { today: TodayView }) {
  const [elapsed, setElapsed] = useState(0);
  const [clock, setClock] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const actionsRef = useRef<HTMLDivElement>(null);
  const running = today.state === "WORKING";

  useEffect(() => {
    const tick = () => {
      setElapsed(running ? Math.max(0, Math.floor((Date.now() - Date.parse(today.asOf)) / 1000)) : 0);
      setClock(istClock.format(new Date()));
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running, today.asOf]);

  // Keep keyboard focus on the card's main button after it re-renders with a new state.
  useEffect(() => {
    if (actionsRef.current?.contains(document.activeElement) || document.activeElement === document.body) {
      actionsRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }
  }, [today.state]);

  const workedSeconds = today.workedMinutes * 60 + elapsed;
  const pct = Math.min(1, workedSeconds / (today.requiredMinutes * 60));
  const showTimer = today.state === "WORKING" || today.state === "ON_BREAK";
  const remaining = Math.max(0, today.requiredMinutes - Math.floor(workedSeconds / 60));

  const act = (kind: EventKind) =>
    start(async () => {
      const res = await checkAction(kind);
      toast(res.ok ? DONE_MESSAGE[kind] : res.error);
    });

  const button = (kind: EventKind, label: string, style: "sun" | "glass", icon?: "login" | "coffee" | "play") => (
    <button type="button" className={`btn btn-${style}`} onClick={() => act(kind)} disabled={pending} aria-busy={pending} data-magnetic={style === "sun" ? true : undefined}>
      {icon ? <Icon name={icon} /> : null}
      {label}
    </button>
  );

  return (
    <section className="clock-card rv" aria-label="Attendance clock" style={{ "--i": 1 } as React.CSSProperties}>
      <div className="cc-top">
        <span className={`cc-state ${today.state}`}><i aria-hidden="true" /><span>{STATE_LABEL[today.state]}</span></span>
        <span className="cc-sub">Flexible hours · Mohali</span>
      </div>
      <div className="cc-mid">
        <div>
          <div className="cc-label">{showTimer ? "Worked today" : today.state === "CHECKED_OUT" ? "Day so far" : "Local time"}</div>
          <div className="cc-time" aria-live="off" suppressHydrationWarning>
            {showTimer ? (
              <>
                {pad(Math.floor(workedSeconds / 3600))}:{pad(Math.floor(workedSeconds / 60) % 60)}
                <small>:{pad(workedSeconds % 60)}</small>
              </>
            ) : today.state === "CHECKED_OUT" ? (
              formatMinutes(today.workedMinutes)
            ) : (
              clock?.slice(0, 5) ?? "--:--"
            )}
          </div>
          <div className="cc-sub">
            {showTimer && today.startedAt ? `In at ${istTimeLabel(new Date(today.startedAt))} · ${remaining > 0 ? `${formatMinutes(remaining)} to a full day` : "Full day done"}` : null}
            {today.state === "NOT_STARTED" ? "Your day starts when you check in." : null}
            {today.state === "CHECKED_OUT" ? "Nice work. Check in again if you pick something up." : null}
          </div>
        </div>
        <div className="cc-ring" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="6" />
            <circle className="p" cx="32" cy="32" r="26" fill="none" stroke="#F2B33D" strokeWidth="6" strokeLinecap="round" pathLength={100} style={{ strokeDashoffset: 100 - pct * 100 }} />
          </svg>
          <b>{Math.round(pct * 100)}%</b>
        </div>
      </div>
      <div className="cc-actions" ref={actionsRef}>
        {today.state === "NOT_STARTED" ? button("IN", "Check in", "sun", "login") : null}
        {today.state === "CHECKED_OUT" ? button("IN", "Check in again", "sun", "login") : null}
        {today.state === "WORKING" ? (
          <>
            {button("OUT", "Check out", "sun")}
            {button("BREAK_START", "Take a break", "glass", "coffee")}
          </>
        ) : null}
        {today.state === "ON_BREAK" ? (
          <>
            {button("BREAK_END", "Resume", "sun", "play")}
            {button("OUT", "Check out", "glass")}
          </>
        ) : null}
      </div>
    </section>
  );
}
