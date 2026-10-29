import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { outbox } from "@/server/mail/mailer";
import { loadCurrentUser } from "@/server/auth/users";
import { createSession } from "@/server/auth/sessions";
import { consumePasswordToken, issuePasswordToken } from "@/server/auth/password-tokens";
import { createEmployee, updateEmployee, updateMyDetails } from "@/server/people/employees";
import { getDirectory, getProfile } from "@/server/people/directory";
import { getOrgChart } from "@/server/people/structure";
import { makeEmployee, resetDb } from "../helpers/db";

const PAN = "ABCDE1234F";

async function org() {
  const dept = await db.department.create({ data: { name: "Engineering" } });
  const desig = await db.designation.create({ data: { title: "Engineer", level: 2 } });
  const hr = await makeEmployee({ name: "Neha Verma", isHR: true });
  const admin = await makeEmployee({ name: "Vikas Malhotra", isAdmin: true });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const engineer = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const colleague = await makeEmployee({ name: "Riya Kapoor" });
  await db.employee.update({
    where: { id: engineer.employee.id },
    data: { pan: PAN, aadhaar: "123412341234", bankAccount: "123456789012", bankIfsc: "SBIN0001234", dateOfBirth: "1995-04-12", designationId: desig.id, departmentId: dept.id },
  });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  const input = (over: Record<string, unknown> = {}) => ({
    fullName: "Test Person",
    workEmail: "Test.Person@LNWebworks.test",
    designationId: desig.id,
    departmentId: dept.id,
    managerId: manager.employee.id,
    joinedOn: "2026-10-01",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    location: "Mohali",
    ...over,
  });
  return { dept, desig, hr, admin, manager, engineer, colleague, me, input };
}

describe("employee management", () => {
  beforeEach(async () => {
    await resetDb();
    outbox.length = 0;
  });

  it("lets HR create an employee with a user account, a code and an invite", async () => {
    const { hr, me, input } = await org();
    const result = await createEmployee(await me(hr), input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await db.employee.findUniqueOrThrow({ where: { id: result.id }, include: { user: true } });
    expect(created.code).toBe("LNW-0001");
    expect(created.user?.email).toBe("test.person@lnwebworks.test");
    expect(await db.auditLog.count({ where: { action: "employee.create", entityId: result.id } })).toBe(1);
    expect(await createEmployee(await me(hr), input())).toEqual({ ok: false, error: "Someone already uses that work email.", field: "workEmail" });
  });

  it("only lets admins assign roles", async () => {
    const { hr, admin, me, input } = await org();
    const byHr = await createEmployee(await me(hr), input({ workEmail: "a@lnwebworks.test", isAdmin: true }));
    const byAdmin = await createEmployee(await me(admin), input({ workEmail: "b@lnwebworks.test", isHR: true }));
    if (!byHr.ok || !byAdmin.ok) throw new Error("create failed");
    expect((await db.user.findUniqueOrThrow({ where: { employeeId: byHr.id } })).isAdmin).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { employeeId: byAdmin.id } })).isHR).toBe(true);
  });

  it("refuses people without permission", async () => {
    const { colleague, me, input } = await org();
    expect(await createEmployee(await me(colleague), input())).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("refuses manager loops and keeps sensitive values out of the audit log", async () => {
    const { hr, manager, engineer, desig, dept, me, input } = await org();
    const loop = await updateEmployee(await me(hr), manager.employee.id, input({ fullName: "Ananya Sharma", workEmail: manager.user.email, managerId: engineer.employee.id }));
    expect(loop).toEqual({ ok: false, error: "That would make them report to themselves.", field: "managerId" });

    const ok = await updateEmployee(
      await me(hr),
      engineer.employee.id,
      input({ fullName: "Arjun Mehta", workEmail: engineer.user.email, designationId: desig.id, departmentId: dept.id, pan: "ZZZZZ9999Z" }),
    );
    expect(ok.ok).toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "employee.update", entityId: engineer.employee.id } });
    expect(audit.after).toContain('"pan":"changed"');
    expect(audit.after).not.toContain("ZZZZZ9999Z");
    expect(audit.before).not.toContain(PAN);
  });

  it("ends sessions and invite links when someone exits", async () => {
    const { hr, engineer, me, input } = await org();
    await createSession(engineer.user.id);
    const token = await issuePasswordToken(engineer.user.id, "SET");
    const res = await updateEmployee(await me(hr), engineer.employee.id, input({ fullName: "Arjun Mehta", workEmail: engineer.user.email, status: "EXITED" }));
    expect(res.ok).toBe(true);
    expect(await db.session.count({ where: { userId: engineer.user.id } })).toBe(0);
    expect((await consumePasswordToken(token, "Brand-new-pass1")).ok).toBe(false);
  });

  it("refuses a password link for someone who has exited", async () => {
    const { engineer } = await org();
    const token = await issuePasswordToken(engineer.user.id, "SET");
    await db.employee.update({ where: { id: engineer.employee.id }, data: { status: "EXITED" } });
    expect(await consumePasswordToken(token, "Brand-new-pass1")).toEqual({ ok: false, error: "This link has expired or was already used. Ask for a new one." });
    expect((await db.user.findUniqueOrThrow({ where: { id: engineer.user.id } })).passwordHash).toBeNull();
  });

  it("lets people edit their contact details but nothing else", async () => {
    const { engineer, me } = await org();
    expect(await updateMyDetails(await me(engineer), { phone: "9876543210", fullName: "Someone Else" })).toEqual({ ok: true, id: engineer.employee.id });
    const after = await db.employee.findUniqueOrThrow({ where: { id: engineer.employee.id } });
    expect(after.phone).toBe("9876543210");
    expect(after.fullName).toBe("Arjun Mehta");
  });
});

describe("directory and profiles", () => {
  beforeEach(resetDb);

  it("never sends sensitive fields to colleagues", async () => {
    const { colleague, engineer, me } = await org();
    const dir = await getDirectory(await me(colleague), {});
    const json = JSON.stringify(dir);
    expect(json).not.toContain(PAN);
    expect(json).not.toContain("123412341234");
    expect(json).not.toContain("123456789012");
    expect(dir.find((d) => d.id === engineer.employee.id)?.designation).toBe("Engineer");

    const profile = (await getProfile(await me(colleague), engineer.employee.id))!;
    expect(profile).not.toHaveProperty("personal");
    expect(profile).not.toHaveProperty("bank");
    expect(profile).not.toHaveProperty("ids");
    expect(JSON.stringify(profile)).not.toContain(PAN);
  });

  it("masks ids for the person themselves and shows them in full to HR", async () => {
    const { hr, engineer, me } = await org();
    expect((await getProfile(await me(engineer), engineer.employee.id))!.ids).toEqual({ pan: "•••• •• 234F", aadhaar: "•••• •••• 1234" });
    expect((await getProfile(await me(hr), engineer.employee.id))!.ids?.pan).toBe(PAN);
  });

  it("lets managers see their reports' attendance but not personal details", async () => {
    const { manager, engineer, colleague, me } = await org();
    const report = (await getProfile(await me(manager), engineer.employee.id))!;
    expect(report.access.attendance).toBe(true);
    expect(report).not.toHaveProperty("personal");
    expect((await getProfile(await me(manager), colleague.employee.id))!.access.attendance).toBe(false);
  });

  it("hides exited people from the directory unless HR asks", async () => {
    const { hr, colleague, engineer, me } = await org();
    await db.employee.update({ where: { id: engineer.employee.id }, data: { status: "EXITED" } });
    expect((await getDirectory(await me(colleague), {})).some((d) => d.id === engineer.employee.id)).toBe(false);
    expect((await getDirectory(await me(hr), { includeExited: true })).some((d) => d.id === engineer.employee.id)).toBe(true);
    expect((await getDirectory(await me(colleague), { q: "riya" })).map((d) => d.fullName)).toEqual(["Riya Kapoor"]);
  });

  it("builds the org chart from active people", async () => {
    const { manager, engineer } = await org();
    await db.employee.update({ where: { id: engineer.employee.id }, data: { status: "EXITED" } });
    const chart = await getOrgChart();
    const managerNode = chart.roots.find((r) => r.id === manager.employee.id);
    expect(managerNode?.children).toEqual([]);
    expect(chart.nodes[manager.employee.id].fullName).toBe("Ananya Sharma");
  });
});
