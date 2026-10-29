import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { CorrectionForm } from "@/components/attendance/CorrectionForm";
import { MonthCalendar } from "@/components/attendance/MonthCalendar";
import { Timeline } from "@/components/attendance/Timeline";
import { addDays, dayLabel, isRealDate, monthKey, monthLabel, monthOf, parseMonthKey, shiftMonth } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { todayKey } from "@/server/clock";
import { listMyCorrections } from "@/server/attendance/corrections";
import { getMonth, getToday } from "@/server/attendance/views";
import { getProfile } from "@/server/people/directory";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Attendance" };

const STATUS_PILL: Record<string, [string, string]> = {
  PENDING: ["warn", "Waiting"],
  APPROVED: ["", "Approved"],
  DECLINED: ["bad", "Declined"],
  WITHDRAWN: ["muted", "Withdrawn"],
};

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string; fix?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayKey();
  const current = monthOf(today);
  const parsed = parseMonthKey(sp.month);
  const shown = parsed && monthKey(parsed) <= monthKey(current) ? parsed : current;

  const [month, todayView, corrections, settings, me] = await Promise.all([
    getMonth(user, user.employeeId, shown.year, shown.month),
    getToday(user.employeeId),
    listMyCorrections(user.employeeId),
    getSettings(),
    getProfile(user, user.employeeId),
  ]);
  if (!month.ok) throw new Error(month.error);

  const earliest = addDays(today, -settings["attendance.correctionWindowDays"]);
  const latest = addDays(today, -1);
  const fixDate = sp.fix && isRealDate(sp.fix) && sp.fix >= earliest && sp.fix <= latest ? sp.fix : latest;
  const prev = shiftMonth(shown.year, shown.month, -1);
  const next = shiftMonth(shown.year, shown.month, 1);
  const joinedMonth = me ? me.joinedOn.slice(0, 7) : "0000-00";
  const s = month.stats;

  return (
    <main className="page" aria-label="Attendance">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">{monthLabel(shown)}</div>
          <WordReveal text="Your attendance" />
          <p className="lede">Click any past day to ask for a correction. Your manager approves it.</p>
        </div>
        <nav className="month-nav" aria-label="Change month">
          <Link href={`/attendance?month=${monthKey(prev)}`} aria-label="Previous month" aria-disabled={monthKey(prev) < joinedMonth ? "true" : undefined}><Icon name="left" /></Link>
          <Link href={`/attendance?month=${monthKey(next)}`} aria-label="Next month" aria-disabled={monthKey(next) > monthKey(current) ? "true" : undefined}><Icon name="right" /></Link>
        </nav>
      </header>

      <section className="kpis">
        <div className="card stat spot rv"><div className="l">Average day</div><div className="v">{formatMinutes(s.averageMinutes)}</div></div>
        <div className="card stat spot rv"><div className="l">Full days</div><div className="v">{s.fullDays}</div></div>
        <div className="card stat spot rv"><div className="l">Short or half days</div><div className="v">{s.shortDays + s.halfDays}</div></div>
        <div className="card stat spot rv"><div className="l">Absent or no check-out</div><div className="v">{s.absences + s.missingCheckouts}</div></div>
      </section>

      <section className="grid">
        <div className="card s8 rv">
          <div className="card-h"><span className="card-t">Month view</span><span className="card-a">Darker means a full day</span></div>
          <MonthCalendar days={month.days} fixHref={(d) => `/attendance?month=${monthKey(shown)}&fix=${d}#fix`} earliestFix={earliest} />
          <div className="legend-row">
            <span><i style={{ background: "var(--brand)" }} />Full day</span>
            <span><i style={{ background: "color-mix(in srgb, var(--brand) 22%, var(--surface))" }} />Short or half</span>
            <span><i style={{ background: "var(--sun-soft)", boxShadow: "inset 0 0 0 1px var(--sun)" }} />Holiday</span>
            <span><i style={{ background: "var(--coral-soft)", boxShadow: "inset 0 0 0 1px var(--coral)" }} />Absent or no check-out</span>
            <span><i style={{ background: "var(--sun)" }} />Correction waiting</span>
          </div>
        </div>
        <div className="s4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card rv">
            <div className="card-h"><span className="card-t">Today</span><span className="card-a">{dayLabel(todayView.workDate)}</span></div>
            <Timeline today={todayView} />
          </div>
          <div className="card rv">
            <div className="card-h"><span className="card-t">Your corrections</span></div>
            {corrections.length === 0 ? <p className="muted">None yet.</p> : null}
            {corrections.slice(0, 6).map((c) => {
              const [cls, label] = STATUS_PILL[c.status] ?? ["muted", c.status];
              return (
                <div className="row" key={c.id}>
                  <div><div className="t">{c.summary}</div><div className="s">{c.reason}</div></div>
                  <span className={`pill ${cls}`} style={{ marginLeft: "auto" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <CorrectionForm defaultDate={fixDate} earliest={earliest} latest={latest} />
    </main>
  );
}
