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

  it("stores attendance and documents for an employee and clears them", async () => {
    const { employee } = await makeEmployee();
    const designation = await db.designation.create({ data: { title: "Engineer", level: 2 } });
    await db.employee.update({ where: { id: employee.id }, data: { designationId: designation.id, pan: "ABCDE1234F" } });
    await db.attendanceEvent.create({ data: { employeeId: employee.id, workDate: "2026-10-28", at: new Date(), kind: "IN", source: "WEB" } });
    await db.attendanceDay.create({ data: { employeeId: employee.id, workDate: "2026-10-28", status: "IN_PROGRESS" } });
    await db.document.create({ data: { employeeId: employee.id, category: "ID_PROOF", fileName: "pan.pdf", mimeType: "application/pdf", size: 10, storageKey: "k1", uploadedById: employee.id } });
    await db.holiday.create({ data: { date: "2026-11-08", name: "Diwali" } });
    await resetDb();
    expect(await db.attendanceEvent.count()).toBe(0);
    expect(await db.document.count()).toBe(0);
    expect(await db.designation.count()).toBe(0);
    expect(await db.holiday.count()).toBe(0);
  });

  it("resetDb removes everything", async () => {
    await makeEmployee();
    await resetDb();
    expect(await db.employee.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  });
});
