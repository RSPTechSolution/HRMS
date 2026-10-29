import Link from "next/link";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { ClockCard } from "@/components/attendance/ClockCard";
import { HoursChart } from "@/components/attendance/HoursChart";
import { formatMinutes } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { getHomeView } from "@/server/home";

export const metadata: Metadata = { title: "Home" };

const PRESENCE: Record<string, [string, string]> = { IN: ["", "In"], BREAK: ["warn", "Break"], OUT: ["sky", "Out"], NOT_IN: ["muted", "Not in"] };

export default async function HomePage() {
  const user = await requireUser();
  const v = await getHomeView(user);
  const showReview = v.kpis.toReview > 0 || user.isManager || user.isHR || user.isAdmin;

  return (
    <main className="page" aria-label="Home">
      <section className="hero">
        <div className="greet rv">
          <div className="eyebrow">{v.dateLabel}</div>
          <WordReveal text={v.heading} accentLast />
          <p className="lede">
            {v.kpis.toReview > 0 ? `${v.kpis.toReview} ${v.kpis.toReview === 1 ? "request is" : "requests are"} waiting for you. ` : ""}
            Here&apos;s your day at a glance.
          </p>
          <div className="qas">
            <Link className="qa" href="/attendance"><span className="ic"><Icon name="clock" /></span>Fix attendance</Link>
            <Link className="qa" href="/people"><span className="ic sky"><Icon name="users" /></span>Find a colleague</Link>
            {v.kpis.toReview > 0 ? <Link className="qa" href="/approvals"><span className="ic sun"><Icon name="inbox" /></span>Review requests</Link> : null}
          </div>
        </div>
        <ClockCard today={v.today} />
      </section>

      <section className="kpis">
        <div className="card kpi spot rv"><div className="kpi-l"><span className="ic"><Icon name="clock" /></span>Average day</div><div className="kpi-v">{formatMinutes(v.kpis.averageMinutes)}</div><div className="kpi-d">last ten working days</div></div>
        <div className="card kpi spot rv"><div className="kpi-l"><span className="ic"><Icon name="check" /></span>Full days</div><div className="kpi-v">{v.kpis.fullDaysThisMonth}</div><div className="kpi-d">this month</div></div>
        <div className="card kpi spot rv"><div className="kpi-l"><span className="ic"><Icon name="calendar" /></span>Short days</div><div className="kpi-v">{v.kpis.shortDaysThisMonth}</div><div className="kpi-d">this month</div></div>
        {showReview ? (
          <Link href="/approvals" className="card kpi spot rv"><div className="kpi-l"><span className="ic"><Icon name="inbox" /></span>To review</div><div className="kpi-v">{v.kpis.toReview}</div><div className="kpi-d">waiting on you</div></Link>
        ) : (
          <Link href="/attendance" className="card kpi spot rv"><div className="kpi-l"><span className="ic"><Icon name="chart" /></span>This month</div><div className="kpi-v">→</div><div className="kpi-d">see your calendar</div></Link>
        )}
      </section>

      <section className="grid">
        <div className="card s8 rv">
          <div className="card-h"><span className="card-t">Hours · last ten working days</span><span className="card-a">Hover or focus a bar</span></div>
          <HoursChart days={v.recent} requiredMinutes={v.today.requiredMinutes} />
        </div>
        {v.team ? (
          <div className="card s4 rv">
            <div className="card-h"><span className="card-t">Team today</span><Link className="link" href="/attendance/team">See all</Link></div>
            <p className="muted" style={{ marginBottom: 8 }}>{v.team.counts.in} in · {v.team.counts.onBreak} on a break · {v.team.counts.notIn} not in yet</p>
            {v.team.people.slice(0, 5).map((p) => {
              const [cls, label] = PRESENCE[p.state];
              return (
                <div className="row" key={p.id}>
                  <Avatar name={p.fullName} />
                  <div><div className="t">{p.fullName}</div><div className="s">{p.since ? `in at ${p.since}` : (p.designation ?? "")}</div></div>
                  <span className={`pill ${cls}`} style={{ marginLeft: "auto" }}>{label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card s4 rv">
            <div className="card-h"><span className="card-t">Latest for you</span></div>
            {v.notes.length === 0 ? <p className="muted">Nothing new right now.</p> : null}
            {v.notes.map((n) => (
              <div className="row" key={n.id}>
                <span className="nt-ic"><Icon name="bell" /></span>
                <div><div className="t">{n.title}</div><div className="s">{n.ago}</div></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {v.team ? (
        <section className="card rv">
          <div className="card-h"><span className="card-t">Latest for you</span></div>
          {v.notes.length === 0 ? <p className="muted">Nothing new right now.</p> : null}
          {v.notes.map((n) => (
            <div className="row" key={n.id}>
              <span className="nt-ic"><Icon name="bell" /></span>
              <div><div className="t">{n.title}</div><div className="s">{n.ago}</div></div>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
