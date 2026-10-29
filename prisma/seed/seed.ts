import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "@/generated/prisma/client";
import { clearAll } from "./clear";
import { APPROVAL_POLICIES, DEMO_PASSWORD, DEPARTMENTS, PEOPLE, type SeedPerson } from "./data";

export function emailFor(p: SeedPerson): string {
  if (p.email) return p.email.toLowerCase();
  return `${p.name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@lnwebworks.test`;
}

export function joinedOnFor(index: number): string {
  return new Date(Date.UTC(2020, 3, 1) + index * 37 * 86_400_000).toISOString().slice(0, 10);
}

export async function seed(db: PrismaClient): Promise<{ employees: number }> {
  await clearAll(db);
  const passwordHash = await hash(DEMO_PASSWORD);

  const deptIds = new Map<string, string>();
  for (const name of DEPARTMENTS) deptIds.set(name, (await db.department.create({ data: { name } })).id);

  const designationIds = new Map<string, string>();
  for (const title of [...new Set(PEOPLE.map((p) => p.designation))]) {
    designationIds.set(title, (await db.designation.create({ data: { title } })).id);
  }

  const empIds = new Map<string, string>();
  for (const [i, p] of PEOPLE.entries()) {
    const email = emailFor(p);
    const deptId = deptIds.get(p.dept);
    if (!deptId) throw new Error(`Unknown department "${p.dept}" for ${p.name}`);
    const e = await db.employee.create({
      data: {
        code: `LNW-${String(i + 1).padStart(4, "0")}`,
        fullName: p.name,
        workEmail: email,
        designationId: designationIds.get(p.designation)!,
        status: p.status ?? "ACTIVE",
        joinedOn: joinedOnFor(i),
        departmentId: deptId,
      },
    });
    empIds.set(p.name, e.id);
    await db.user.create({ data: { email, passwordHash, employeeId: e.id, isHR: !!p.isHR, isPayroll: !!p.isPayroll, isAdmin: !!p.isAdmin } });
  }

  for (const p of PEOPLE) {
    if (!p.manager) continue;
    const managerId = empIds.get(p.manager);
    if (!managerId) throw new Error(`Unknown manager "${p.manager}" for ${p.name}`);
    await db.employee.update({ where: { id: empIds.get(p.name)! }, data: { managerId } });
  }

  for (const [type, steps] of Object.entries(APPROVAL_POLICIES)) {
    await db.approvalPolicy.create({ data: { type, steps: JSON.stringify(steps) } });
  }

  const arjun = await db.user.findUniqueOrThrow({ where: { email: "employee@lnwebworks.test" } });
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  await db.notification.createMany({
    data: [
      { userId: arjun.id, kind: "welcome", title: "Welcome to LN People — your HR, all in one place", link: "/home", createdAt: minutesAgo(12) },
      { userId: arjun.id, kind: "kudos", title: "Rohit gave you kudos for the client call", link: "/home", createdAt: minutesAgo(65) },
      { userId: arjun.id, kind: "announcement", title: "Diwali celebration · Fri 6 Nov, 4 pm", createdAt: minutesAgo(60 * 26), readAt: minutesAgo(60 * 20) },
    ],
  });

  return { employees: PEOPLE.length };
}
