import { db } from "@/lib/db";
import { clearAll } from "../../prisma/seed/clear";

export async function resetDb(): Promise<void> {
  await clearAll(db);
}

let seq = 0;

export type MakeEmployeeOptions = {
  name?: string;
  managerId?: string | null;
  isHR?: boolean;
  isAdmin?: boolean;
  isPayroll?: boolean;
  status?: "ACTIVE" | "NOTICE" | "EXITED";
  passwordHash?: string | null;
};

export async function makeEmployee(opts: MakeEmployeeOptions = {}) {
  seq += 1;
  const name = opts.name ?? `Person ${seq}`;
  const email = `person${seq}.${Date.now()}@lnwebworks.test`;
  const employee = await db.employee.create({
    data: {
      code: `T-${seq}-${Date.now()}`,
      fullName: name,
      workEmail: email,
      designation: "Engineer",
      joinedOn: "2025-01-01",
      status: opts.status ?? "ACTIVE",
      managerId: opts.managerId ?? null,
    },
  });
  const user = await db.user.create({
    data: {
      email,
      employeeId: employee.id,
      isHR: !!opts.isHR,
      isAdmin: !!opts.isAdmin,
      isPayroll: !!opts.isPayroll,
      passwordHash: opts.passwordHash ?? null,
    },
  });
  return { employee, user };
}
