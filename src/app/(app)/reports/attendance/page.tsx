import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { monthKey, monthLabel, monthOf, parseMonthKey, shiftMonth } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { todayKey } from "@/server/clock";
import { getMonthlyReport } from "@/server/attendance/report";

export const metadata: Metadata = { title: "Attendance report" };

export default async function AttendanceReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const current = monthOf(todayKey());
  const parsed = parseMonthKey((await searchParams).month);
  const shown = parsed && monthKey(parsed) <= monthKey(current) ? parsed : current;
  const rows = await getMonthlyReport(user, shown.year, shown.month);
  if (!rows) notFound();
  const prev = shiftMonth(shown.year, shown.month, -1);
  const next = shiftMonth(shown.year, shown.month, 1);

  return (
    <main className="page" aria-label="Attendance report">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">{monthLabel(shown)} · {rows.length} people</div>
          <WordReveal text="Attendance report" />
        </div>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <nav className="month-nav" aria-label="Change month">
            <Link href={`/reports/attendance?month=${monthKey(prev)}`} aria-label="Previous month"><Icon name="left" /></Link>
            <Link href={`/reports/attendance?month=${monthKey(next)}`} aria-label="Next month" aria-disabled={monthKey(next) > monthKey(current) ? "true" : undefined}><Icon name="right" /></Link>
          </nav>
          <Link className="btn btn-ghost" href="/attendance/team">Team today</Link>
          <a className="btn btn-primary" href={`/api/reports/attendance?month=${monthKey(shown)}`} download data-magnetic><Icon name="download" /> Download CSV</a>
        </div>
      </header>
      <section className="card rv table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Department</th><th>Full</th><th>Short</th><th>Half</th><th>Absent</th><th>No check-out</th><th>Holidays</th><th>Total</th><th>Average</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td><Link className="link" href={`/people/${r.employeeId}?tab=attendance&month=${monthKey(shown)}`}>{r.fullName}</Link></td>
                <td>{r.department ?? "—"}</td>
                <td>{r.present}</td>
                <td>{r.short}</td>
                <td>{r.halfDay}</td>
                <td>{r.absent}</td>
                <td>{r.missingCheckout}</td>
                <td>{r.holidays}</td>
                <td>{formatMinutes(r.totalMinutes)}</td>
                <td>{formatMinutes(r.averageMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
