import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WordReveal } from "@/components/ui/WordReveal";
import { EmployeeForm } from "@/components/people/EmployeeForm";
import { can } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { todayKey } from "@/server/clock";
import { getDirectory } from "@/server/people/directory";
import { listDepartments, listDesignations } from "@/server/people/structure";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const user = await requireUser();
  if (!can(user, "employees.manage")) notFound();
  const [designations, departments, people] = await Promise.all([listDesignations(), listDepartments(), getDirectory(user, {}, async () => new Map())]);
  return (
    <main className="page" aria-label="Add employee">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">People</div>
          <WordReveal text="Add an employee" />
          <p className="lede">They&apos;ll get an email with a link to set their password.</p>
        </div>
      </header>
      <EmployeeForm
        mode="create"
        designations={designations.map((d) => ({ id: d.id, label: d.title }))}
        departments={departments.map((d) => ({ id: d.id, label: d.name }))}
        managers={people.map((p) => ({ id: p.id, label: `${p.fullName}${p.designation ? ` · ${p.designation}` : ""}` }))}
        canAssignRoles={user.isAdmin}
        canEditEmail
        initial={{ joinedOn: todayKey(), location: "Mohali", employmentType: "FULL_TIME", status: "ACTIVE" }}
      />
    </main>
  );
}
