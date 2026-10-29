import Link from "next/link";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/Avatar";
import { WordReveal } from "@/components/ui/WordReveal";
import { requireUser } from "@/server/auth/current-user";
import { getTeamToday } from "@/server/attendance/team";

export const metadata: Metadata = { title: "Team today" };

const STATE: Record<string, [string, string]> = { IN: ["", "In"], BREAK: ["warn", "On a break"], OUT: ["sky", "Checked out"], NOT_IN: ["muted", "Not in yet"] };

export default async function TeamTodayPage() {
  const user = await requireUser();
  const team = await getTeamToday(user);
  return (
    <main className="page" aria-label="Team today">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">Attendance</div>
          <WordReveal text="Your team today" />
        </div>
      </header>
      {!team ? (
        <div className="card"><p className="muted">You don&apos;t have anyone reporting to you yet.</p></div>
      ) : (
        <>
          <section className="kpis">
            <div className="card stat rv"><div className="l">In now</div><div className="v">{team.counts.in}</div></div>
            <div className="card stat rv"><div className="l">On a break</div><div className="v">{team.counts.onBreak}</div></div>
            <div className="card stat rv"><div className="l">Checked out</div><div className="v">{team.counts.out}</div></div>
            <div className="card stat rv"><div className="l">Not in yet</div><div className="v">{team.counts.notIn}</div></div>
          </section>
          <section className="card rv">
            {team.people.map((p) => {
              const [cls, label] = STATE[p.state];
              return (
                <div className="row" key={p.id}>
                  <Avatar name={p.fullName} />
                  <div>
                    <div className="t"><Link className="link" href={`/people/${p.id}?tab=attendance`}>{p.fullName}</Link></div>
                    <div className="s">{p.designation ?? "—"}{p.since ? ` · in at ${p.since}` : ""}</div>
                  </div>
                  <span className={`pill ${cls}`} style={{ marginLeft: "auto" }}>{label}</span>
                </div>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
