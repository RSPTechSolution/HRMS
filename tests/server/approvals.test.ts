import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadCurrentUser } from "@/server/auth/users";
import { registerApprovalType } from "@/server/approvals/registry";
import { decideApproval, listPendingFor, submitApproval, withdrawApproval } from "@/server/approvals/engine";
import { makeEmployee, resetDb } from "../helpers/db";

const events: string[] = [];
registerApprovalType("TEST", {
  label: "Test",
  link: (ref) => `/test/${ref.subjectId}`,
  onApproved: async (_tx, ref) => {
    events.push(`approved:${ref.subjectId}`);
  },
  onClosed: async (_tx, ref, status) => {
    events.push(`${status.toLowerCase()}:${ref.subjectId}`);
  },
});

async function org() {
  const hr = await makeEmployee({ name: "Neha Verma", isHR: true });
  const hr2 = await makeEmployee({ name: "Sonia Grewal", isHR: true });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const emp = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  return { hr, hr2, manager, emp, me };
}

const submit = (requesterId: string, subjectId = "s1") =>
  db.$transaction((tx) => submitApproval(tx, { type: "TEST", subjectId, requesterId, summary: "Test · 3 Nov" }));

describe("approval engine", () => {
  beforeEach(async () => {
    await resetDb();
    events.length = 0;
    await db.approvalPolicy.create({ data: { type: "TEST", steps: JSON.stringify(["MANAGER", "HR"]) } });
  });

  it("routes manager → HR, notifies each approver and the requester, and runs hooks", async () => {
    const { hr, manager, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect(req.steps.map((s) => s.role)).toEqual(["MANAGER", "HR"]);
    expect(await db.notification.count({ where: { userId: manager.user.id, kind: "approval.pending" } })).toBe(1);

    expect(await listPendingFor(await me(manager))).toHaveLength(1);
    expect(await decideApproval(await me(manager), req.id, "APPROVED")).toEqual({ ok: true, status: "PENDING" });
    expect(await db.notification.count({ where: { userId: hr.user.id, kind: "approval.pending" } })).toBe(1);
    expect(await listPendingFor(await me(manager))).toHaveLength(0);

    expect(await decideApproval(await me(hr), req.id, "APPROVED")).toEqual({ ok: true, status: "APPROVED" });
    expect(events).toEqual(["approved:s1"]);
    const done = await db.notification.findFirstOrThrow({ where: { userId: emp.user.id, kind: "approval.approved" } });
    expect(done.link).toBe("/test/s1");
    expect(await db.auditLog.count({ where: { entityId: req.id } })).toBe(2);
  });

  it("declines with a reason and runs the close hook", async () => {
    const { manager, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect(await decideApproval(await me(manager), req.id, "DECLINED")).toEqual({ ok: false, error: "Add a short reason when declining." });
    expect(await decideApproval(await me(manager), req.id, "DECLINED", "Release week")).toEqual({ ok: true, status: "DECLINED" });
    expect(events).toEqual(["declined:s1"]);
    const n = await db.notification.findFirstOrThrow({ where: { userId: emp.user.id, kind: "approval.declined" } });
    expect(n.title).toContain("Release week");
  });

  it("refuses a second decision from someone who already decided", async () => {
    const { manager, hr, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect((await decideApproval(await me(manager), req.id, "APPROVED")).ok).toBe(true);
    expect(await decideApproval(await me(manager), req.id, "APPROVED")).toEqual({ ok: false, error: "You can't act on this request." });
    expect((await decideApproval(await me(hr), req.id, "APPROVED")).ok).toBe(true);
    const steps = await db.approvalStep.findMany({ where: { requestId: req.id }, orderBy: { order: "asc" } });
    expect(steps.map((s) => s.decidedById)).toEqual([manager.employee.id, hr.employee.id]);
  });

  it("does not let one HR person approve both steps", async () => {
    const { hr, hr2, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect((await decideApproval(await me(hr), req.id, "APPROVED")).ok).toBe(true);
    expect(await decideApproval(await me(hr), req.id, "APPROVED")).toEqual({ ok: false, error: "You can't act on this request." });
    expect((await decideApproval(await me(hr2), req.id, "APPROVED")).ok).toBe(true);
  });

  it("skips an exited manager and routes straight to HR", async () => {
    const { hr, manager, emp, me } = await org();
    await db.employee.update({ where: { id: manager.employee.id }, data: { status: "EXITED" } });
    const req = await submit(emp.employee.id);
    expect(req.steps.map((s) => s.role)).toEqual(["HR"]);
    expect(await listPendingFor(await me(hr))).toHaveLength(1);
  });

  it("lets the requester withdraw while pending, and nobody else", async () => {
    const { manager, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect((await withdrawApproval(await me(manager), req.id)).ok).toBe(false);
    expect(await withdrawApproval(await me(emp), req.id)).toEqual({ ok: true, status: "WITHDRAWN" });
    expect(events).toEqual(["withdrawn:s1"]);
    expect(await decideApproval(await me(manager), req.id, "APPROVED")).toEqual({ ok: false, error: "This request is no longer pending." });
  });

  it("never lists people's own requests as waiting on them", async () => {
    const { hr, me } = await org();
    await submit(hr.employee.id);
    expect(await listPendingFor(await me(hr))).toHaveLength(0);
  });

  it("fails loudly for an unknown request type and a missing request", async () => {
    const { emp, me } = await org();
    await expect(
      db.$transaction((tx) => submitApproval(tx, { type: "NOPE", subjectId: "x", requesterId: emp.employee.id, summary: "x" })),
    ).rejects.toThrow('No approval policy configured for "NOPE"');
    expect(await decideApproval(await me(emp), "missing", "APPROVED")).toEqual({ ok: false, error: "Request not found." });
  });
});
