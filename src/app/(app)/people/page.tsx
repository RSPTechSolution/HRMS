import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { PersonCard } from "@/components/people/PersonCard";
import { SearchBox } from "@/components/people/SearchBox";
import { can } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { getDirectory } from "@/server/people/directory";
import { listDepartments } from "@/server/people/structure";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const user = await requireUser();
  const { q, dept } = await searchParams;
  const [people, departments] = await Promise.all([getDirectory(user, { q, departmentId: dept }), listDepartments()]);
  const total = departments.reduce((sum, d) => sum + d._count.employees, 0);
  const chipHref = (id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (id) p.set("dept", id);
    const s = p.toString();
    return s ? `/people?${s}` : "/people";
  };

  return (
    <main className="page" aria-label="People">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">{total} people · {departments.length} teams</div>
          <WordReveal text="The people of LN Webworks" />
        </div>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <Link className="btn btn-ghost" href="/people/org"><Icon name="org" /> Org chart</Link>
          {can(user, "employees.manage") ? (
            <>
              <Link className="btn btn-ghost" href="/people/structure">Teams and titles</Link>
              <Link className="btn btn-primary" href="/people/new" data-magnetic><Icon name="plus" /> Add employee</Link>
            </>
          ) : null}
        </div>
      </header>
      <div className="toolbar rv" style={{ "--i": 1 } as React.CSSProperties}>
        <SearchBox placeholder="Search by name, code or role" />
        <nav className="chips" aria-label="Filter by team">
          <Link className="chip" href={chipHref()} aria-current={!dept ? "true" : undefined}>All</Link>
          {departments.map((d) => (
            <Link key={d.id} className="chip" href={chipHref(d.id)} aria-current={dept === d.id ? "true" : undefined}>{d.name}</Link>
          ))}
        </nav>
      </div>
      <section className="tgrid" aria-live="polite">
        {people.length === 0 ? (
          <div className="empty"><b>Nobody matches</b>Nobody matches “{q}”. Try a role, such as “designer”.</div>
        ) : (
          people.map((p, i) => <PersonCard key={p.id} person={p} index={i} />)
        )}
      </section>
    </main>
  );
}
