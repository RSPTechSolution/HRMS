import { formatMinutes } from "@/lib/format";
import type { TodayView } from "@/server/attendance/views";

const LABEL = { IN: "Checked in", OUT: "Checked out", BREAK_START: "Break started", BREAK_END: "Back at work" } as const;

export function Timeline({ today }: { today: TodayView }) {
  if (today.events.length === 0) return <p className="muted">You haven&apos;t checked in yet today.</p>;
  return (
    <ol className="tl">
      {today.events.map((e, i) => (
        <li key={`${e.at}-${i}`} style={{ animationDelay: `${i * 60}ms` }}>
          <div className="tt">{e.time}</div>
          <div className="t2">{LABEL[e.kind]}</div>
        </li>
      ))}
      <li>
        <div className="tt">So far</div>
        <div className="t2">{formatMinutes(today.workedMinutes)} worked</div>
      </li>
    </ol>
  );
}
