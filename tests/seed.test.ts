import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { istDateKey } from "@/lib/dates";
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

  it("fills profiles with valid-looking details", async () => {
    expect(await db.designation.count()).toBeGreaterThanOrEqual(20);
    const employees = await db.employee.findMany();
    for (const e of employees) {
      expect(e.pan).toMatch(/^[A-Z]{5}[0-9]{4}[A-Z]$/);
      expect(e.bankIfsc).toMatch(/^[A-Z]{4}0[A-Z0-9]{6}$/);
      expect(e.aadhaar).toMatch(/^\d{12}$/);
      expect(e.phone).toMatch(/^\+?\d{10,15}$/);
      expect(e.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("seeds the 2026 holidays and three months of attendance", async () => {
    expect(await db.holiday.count()).toBe(9);
    const arjun = await db.employee.findUniqueOrThrow({ where: { workEmail: "employee@lnwebworks.test" } });
    const today = istDateKey(new Date());
    expect(await db.attendanceEvent.count({ where: { employeeId: arjun.id, workDate: today } })).toBe(0);
    const days = await db.attendanceEvent.groupBy({ by: ["workDate"], where: { employeeId: arjun.id } });
    expect(days.length).toBeGreaterThan(40);
    expect(days.every((d) => d.workDate < today)).toBe(true);
  });

  it("leaves a correction from Karan waiting on Ananya", async () => {
    const ananya = await db.employee.findUniqueOrThrow({ where: { workEmail: "manager@lnwebworks.test" } });
    const pending = await db.approvalRequest.findMany({ where: { type: "ATTENDANCE_CORRECTION", status: "PENDING" }, include: { steps: true } });
    expect(pending).toHaveLength(1);
    expect(pending[0].steps[0]).toMatchObject({ role: "MANAGER", approverId: ananya.id });
  });

  it("seeds all approval policies and is safe to run twice", async () => {
    expect(await db.approvalPolicy.count()).toBe(6);
    await seed(db);
    expect(await db.employee.count()).toBe(48);
  }, 60_000);
});
