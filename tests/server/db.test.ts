import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeEmployee, resetDb } from "../helpers/db";

describe("database harness", () => {
  beforeEach(resetDb);

  it("creates an employee linked to a user account", async () => {
    const boss = await makeEmployee({ name: "Ananya Sharma" });
    const { employee, user } = await makeEmployee({ name: "Arjun Mehta", managerId: boss.employee.id });
    const loaded = await db.employee.findUniqueOrThrow({ where: { id: employee.id }, include: { manager: true, user: true } });
    expect(loaded.manager?.fullName).toBe("Ananya Sharma");
    expect(loaded.user?.id).toBe(user.id);
  });

  it("resetDb removes everything", async () => {
    await makeEmployee();
    await resetDb();
    expect(await db.employee.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  });
});
