import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WordReveal } from "@/components/ui/WordReveal";
import { StructureForm } from "@/components/people/StructureForm";
import { can } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { listDepartments, listDesignations } from "@/server/people/structure";

export const metadata: Metadata = { title: "Teams and titles" };

export default async function StructurePage() {
  const user = await requireUser();
  if (!can(user, "employees.manage")) notFound();
  const [departments, designations] = await Promise.all([listDepartments(), listDesignations()]);
  return (
    <main className="page" aria-label="Teams and titles">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">People</div>
          <WordReveal text="Teams and titles" />
          <p className="lede">Renaming here updates everyone who belongs to it.</p>
        </div>
      </header>
      <section className="grid">
        <div className="card s6 rv" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Departments</span><span className="card-a">{departments.length}</span></div>
          <StructureForm kind="department" />
          {departments.map((d) => <StructureForm key={d.id} kind="department" id={d.id} name={d.name} count={d._count.employees} />)}
        </div>
        <div className="card s6 rv" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Designations</span><span className="card-a">Higher level = more senior</span></div>
          <StructureForm kind="designation" />
          {designations.map((d) => <StructureForm key={d.id} kind="designation" id={d.id} name={d.title} level={d.level} count={d._count.employees} />)}
        </div>
      </section>
    </main>
  );
}
