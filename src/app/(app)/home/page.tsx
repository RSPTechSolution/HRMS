import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { primaryRoleLabel } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { getHomeView } from "@/server/home";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const { dateLabel, heading, notes } = await getHomeView(user);

  return (
    <main className="page" aria-label="Home">
      <header className="ph">
        <div className="rv" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="eyebrow">{dateLabel}</div>
          <WordReveal text={heading} accentLast />
          <p className="lede">Welcome to LN People. Attendance, time off and your team will show up here as they go live.</p>
        </div>
      </header>
      <section className="grid">
        <div className="card s8 rv" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Latest for you</span><span className="card-a">{notes.length ? `${notes.length} recent` : ""}</span></div>
          {notes.length === 0 ? <p className="muted">Nothing new right now.</p> : null}
          {notes.map((n) => (
            <div className="row" key={n.id}>
              <span className="nt-ic"><Icon name="bell" /></span>
              <div>
                <div className="t">{n.title}</div>
                <div className="s">{n.ago}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card s4 spot rv" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Your account</span><span className="pill">{primaryRoleLabel(user)}</span></div>
          <p className="muted">Signed in as {user.email}.</p>
          <p style={{ marginTop: 16 }}><Link className="link" href="/profile">View your profile</Link></p>
        </div>
      </section>
    </main>
  );
}
