import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/server/auth/login";
import { DEMO_LOGINS, DEMO_PASSWORD, PEOPLE } from "../prisma/seed/data";
import { seed } from "../prisma/seed/seed";

describe("seed", () => {
  beforeAll(async () => {
    await seed(db);
  }, 60_000);

  it("creates 48 employees with unique codes and lowercase emails", async () => {
    expect(PEOPLE).toHaveLength(48);
    const employees = await db.employee.findMany();
    expect(employees).toHaveLength(48);
    expect(new Set(employees.map((e) => e.code)).size).toBe(48);
    for (const e of employees) expect(e.workEmail).toBe(e.workEmail.toLowerCase());
  });

  it("links every manager and has exactly one person without a manager", async () => {
    const employees = await db.employee.findMany();
    expect(employees.filter((e) => e.managerId === null).map((e) => e.fullName)).toEqual(["Vikas Malhotra"]);
    const ids = new Set(employees.map((e) => e.id));
    for (const e of employees) if (e.managerId) expect(ids.has(e.managerId)).toBe(true);
  });

  it("lets every demo login sign in", async () => {
    for (const login of DEMO_LOGINS) {
      expect((await authenticate(login.email, DEMO_PASSWORD)).ok).toBe(true);
    }
  });

  it("seeds all approval policies and is safe to run twice", async () => {
    expect(await db.approvalPolicy.count()).toBe(6);
    await seed(db);
    expect(await db.employee.count()).toBe(48);
  }, 60_000);
});
