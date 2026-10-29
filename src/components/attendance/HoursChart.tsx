import { formatMinutes } from "@/lib/format";

type Day = { date: string; label: string; minutes: number; today: boolean; holidayName: string | null };

/** Last ten working days, with a dashed line at a full day. Each bar is focusable with its own label. */
export function HoursChart({ days, requiredMinutes }: { days: Day[]; requiredMinutes: number }) {
  const scale = Math.max(requiredMinutes * 1.15, ...days.map((d) => d.minutes));
  return (
    <div className="chart" role="list" aria-label="Hours over the last ten working days">
      <div className="target" style={{ bottom: `calc(24px + (100% - 24px) * ${requiredMinutes / scale})` }} aria-hidden="true">
        <span>{formatMinutes(requiredMinutes)}</span>
      </div>
      {days.map((d, k) => {
        const label = `${d.label} · ${d.holidayName ? `${d.holidayName} (holiday)` : d.today ? `Today · ${formatMinutes(d.minutes)} so far` : formatMinutes(d.minutes)}`;
        const height = d.holidayName && d.minutes === 0 ? 0.22 : Math.max(d.today ? 0.08 : 0.03, d.minutes / scale);
        const cls = d.holidayName ? "hol" : d.today ? "today" : d.minutes >= requiredMinutes ? "hi" : "";
        return (
          <div key={d.date} className={`bar ${cls}`} role="listitem" tabIndex={0} title={label} aria-label={label} style={{ "--k": k, "--h": height } as React.CSSProperties}>
            <i />
            <span>{d.today ? "Today" : d.label.split(" ")[1]}</span>
          </div>
        );
      })}
    </div>
  );
}
