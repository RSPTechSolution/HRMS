import type { Metadata } from "next";
import { WordReveal } from "@/components/ui/WordReveal";
import { OrgTree } from "@/components/people/OrgTree";
import { requireUser } from "@/server/auth/current-user";
import { getOrgChart } from "@/server/people/structure";

export const metadata: Metadata = { title: "Org chart" };

export default async function OrgPage() {
  await requireUser();
  const chart = await getOrgChart();
  return (
    <main className="page" aria-label="Org chart">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">People</div>
          <WordReveal text="Who reports to whom" />
        </div>
      </header>
      <section className="card rv" style={{ "--i": 1 } as React.CSSProperties}>
        <OrgTree roots={chart.roots} people={chart.nodes} />
      </section>
    </main>
  );
}
