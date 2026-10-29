import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getMyProfile } from "@/server/profile";
import { getHomeView } from "@/server/home";
import { loadCurrentUser } from "@/server/auth/users";
import { makeEmployee, resetDb } from "../helpers/db";

describe("getHomeView", () => {
  beforeEach(resetDb);

  it("greets by first name in IST and lists the latest notifications", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    await db.notification.create({ data: { userId: user.id, kind: "k", title: "Hello", createdAt: new Date("2026-10-28T03:18:00Z") } });
    const view = await getHomeView((await loadCurrentUser(user.id))!, new Date("2026-10-28T03:30:00Z"));
    expect(view).toEqual({
      dateLabel: "Wednesday 28 October",
      heading: "Good morning, Arjun.",
      notes: [{ id: expect.any(String), title: "Hello", ago: "12 min ago" }],
    });
  });
});

describe("getMyProfile", () => {
  beforeEach(resetDb);

  it("returns job details with manager and department names", async () => {
    const dept = await db.department.create({ data: { name: "Engineering" } });
    const boss = await makeEmployee({ name: "Ananya Sharma" });
    const { user, employee } = await makeEmployee({ name: "Arjun Mehta", managerId: boss.employee.id });
    const designation = await db.designation.create({ data: { title: "Senior Developer", level: 3 } });
    await db.employee.update({ where: { id: employee.id }, data: { departmentId: dept.id, designationId: designation.id } });
    expect(await getMyProfile(user.id)).toMatchObject({
      fullName: "Arjun Mehta",
      designation: "Senior Developer",
      department: "Engineering",
      managerName: "Ananya Sharma",
      joinedOn: "2025-01-01",
    });
  });

  it("returns null for an unknown user", async () => {
    expect(await getMyProfile("missing")).toBeNull();
  });
});
