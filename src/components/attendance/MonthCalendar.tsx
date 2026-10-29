import Link from "next/link";
import { dayLabel } from "@/lib/dates";
import { formatMinutes } from "@/lib/format";
import { DAY_STATUS_LABELS } from "@/domain/attendance/types";
import type { MonthDay } from "@/server/attendance/views";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FIXABLE = new Set(["ABSENT", "SHORT", "HALF_DAY", "MISSING_CHECKOUT", "PRESENT"]);

function describe(d: MonthDay): string {
  const parts = [dayLabel(d.date), d.beforeJoining ? "Before joining" : (d.holidayName ?? DAY_STATUS_LABELS[d.status])];
  if (d.workedMinutes > 0) parts.push(formatMinutes(d.workedMinutes));
  if (d.firstIn) parts.push(`in at ${d.firstIn}`);
  if (d.lastOut) parts.push(`out at ${d.lastOut}`);
  if (d.correctionPending) parts.push("correction waiting");
  return parts.join(" · ");
}

/** Month heat calendar. With `fixHref`, past working days link to the correction form. */
export function MonthCalendar({ days, fixHref, earliestFix }: { days: MonthDay[]; fixHref?: (date: string) => string; earliestFix?: string }) {
  const leading = (days[0].weekday + 6) % 7;
  return (
    <div className="heat" role="list" aria-label="Month calendar">
      {DOW.map((d) => <div key={d} className="cal-dow" aria-hidden="true">{d}</div>)}
      {Array.from({ length: leading }, (_, i) => <div key={`pad-${i}`} aria-hidden="true" />)}
      {days.map((d, k) => {
        const label = describe(d);
        const cls = `hc ${d.beforeJoining ? "before" : d.status}${d.correctionPending ? " pending" : ""}`;
        const style = { "--k": k } as React.CSSProperties;
        const detail = d.holidayName ?? (d.workedMinutes > 0 ? formatMinutes(d.workedMinutes) : d.status === "ABSENT" ? "Absent" : d.status === "MISSING_CHECKOUT" ? "No check-out" : "");
        const body = (
          <>
            <b>{Number(d.date.slice(8))}</b>
            <em>{detail}</em>
          </>
        );
        const fixable = fixHref && !d.beforeJoining && FIXABLE.has(d.status) && !d.correctionPending && (!earliestFix || d.date >= earliestFix);
        return fixable ? (
          <Link key={d.date} href={fixHref(d.date)} className={cls} style={style} title={`${label} — ask for a correction`} aria-label={`${label}. Ask for a correction`} role="listitem">
            {body}
          </Link>
        ) : (
          <div key={d.date} className={cls} style={style} title={label} aria-label={label} role="listitem">
            {body}
          </div>
        );
      })}
    </div>
  );
}
