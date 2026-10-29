import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { WordReveal } from "@/components/ui/WordReveal";
import { primaryRoleLabel } from "@/domain/auth/permissions";
import { formatIsoDate } from "@/lib/time";
import { logoutAction, logoutEverywhereAction } from "@/app/(auth)/actions";
import { requireUser } from "@/server/auth/current-user";
import { getMyProfile } from "@/server/profile";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getMyProfile(user.userId);
  if (!profile) notFound();
  const rows: [string, string][] = [
    ["Employee code", profile.code],
    ["Work email", profile.email],
    ["Designation", profile.designation ?? "—"],
    ["Department", profile.department ?? "—"],
    ["Reports to", profile.managerName ?? "—"],
    ["Joined", formatIsoDate(profile.joinedOn)],
  ];

  return (
    <main className="page" aria-label="My profile">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">{primaryRoleLabel(user)}</div>
          <WordReveal text={profile.fullName} />
        </div>
      </header>
      <section className="grid">
        <div className="card s8 rv" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Job details</span><Avatar name={profile.fullName} size="lg" /></div>
          {rows.map(([label, value]) => (
            <div className="row" key={label}>
              <div className="s" style={{ width: 140 }}>{label}</div>
              <div className="t">{value}</div>
            </div>
          ))}
        </div>
        <div className="card s4 rv" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Security</span></div>
          <p className="muted">Signed in on a shared computer? Sign out everywhere to end every session, including this one.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <form action={logoutAction}><button type="submit" className="btn btn-ghost">Sign out</button></form>
            <form action={logoutEverywhereAction}><button type="submit" className="btn btn-ghost">Sign out everywhere</button></form>
          </div>
        </div>
      </section>
    </main>
  );
}
