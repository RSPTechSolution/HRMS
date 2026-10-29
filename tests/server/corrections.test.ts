import { beforeEach, describe, expect, it } from "vitest";
import "@/server/approvals/types";
import { db } from "@/lib/db";
import { istDateTime } from "@/lib/dates";
import { loadCurrentUser } from "@/server/auth/users";
import { decideApproval, listPendingFor, withdrawApproval } from "@/server/approvals/engine";
import { listMyCorrections, requestCorrection } from "@/server/attendance/corrections";
import { getInbox } from "@/server/approvals/inbox";
import { makeEmployee, resetDb } from "../helpers/db";

const now = istDateTime("2026-10-28", "12:00");
const fix = (over: Record<string, unknown> = {}) => ({ workDate: "2026-10-27", inTime: "09:30", outTime: "18:30", reason: "Forgot to check in", ...over });

async function org() {
  await db.approvalPolicy.create({ data: { type: "ATTENDANCE_CORRECTION", steps: JSON.stringify(["MANAGER"]) } });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const engineer = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  return { manager, engineer, me };
}

const dayRow = (employeeId: string) => db.attendanceDay.findUnique({ where: { employeeId_workDate: { employeeId, workDate: "2026-10-27" } } });

describe("attendance corrections", () => {
  beforeEach(resetDb);

  it("routes to the manager and, once approved, replaces the day", async () => {
    const { manager, engineer, me } = await org();
    const res = await requestCorrection(await me(engineer), fix(), now);
    if (!res.ok) throw new Error(res.error);
    const pending = await listPendingFor(await me(manager));
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ type: "ATTENDANCE_CORRECTION", summary: "Tue 27 Oct · 09:30–18:30" });

    expect((await decideApproval(await me(manager), pending[0].id, "APPROVED")).ok).toBe(true);
    const events = await db.attendanceEvent.findMany({ where: { employeeId: engineer.employee.id, workDate: "2026-10-27" }, orderBy: { at: "asc" } });
    expect(events.map((e) => [e.kind, e.source])).toEqual([["IN", "CORRECTION"], ["OUT", "CORRECTION"]]);
    expect((await dayRow(engineer.employee.id))?.status).toBe("PRESENT");
    expect((await db.attendanceCorrection.findUniqueOrThrow({ where: { id: res.id } })).status).toBe("APPROVED");
    expect(await db.notification.count({ where: { userId: engineer.user.id, kind: "approval.approved" } })).toBe(1);
    expect(await listMyCorrections(engineer.employee.id)).toEqual([
      expect.objectContaining({ workDate: "2026-10-27", status: "APPROVED", approvalId: pending[0].id }),
    ]);
  });

  it("refuses a second request for the same day while one is waiting", async () => {
    const { engineer, me } = await org();
    expect((await requestCorrection(await me(engineer), fix(), now)).ok).toBe(true);
    expect(await requestCorrection(await me(engineer), fix({ inTime: "10:00" }), now)).toEqual({ ok: false, error: "There's already a correction waiting for that day." });
  });

  it("leaves the day alone when declined or withdrawn", async () => {
    const { manager, engineer, me } = await org();
    const first = await requestCorrection(await me(engineer), fix(), now);
    if (!first.ok) throw new Error(first.error);
    const [req] = await listPendingFor(await me(manager));
    await decideApproval(await me(manager), req.id, "DECLINED", "You were on leave");
    expect((await db.attendanceCorrection.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("DECLINED");
    expect(await db.attendanceEvent.count({ where: { employeeId: engineer.employee.id } })).toBe(0);

    const second = await requestCorrection(await me(engineer), fix(), now);
    if (!second.ok) throw new Error(second.error);
    const [req2] = await listPendingFor(await me(manager));
    await withdrawApproval(await me(engineer), req2.id);
    expect((await db.attendanceCorrection.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("WITHDRAWN");
  });

  it("lets only one of two simultaneous requests for the same day through", async () => {
    const { engineer, me } = await org();
    const u = await me(engineer);
    const results = await Promise.all([requestCorrection(u, fix(), now), requestCorrection(u, fix({ inTime: "10:00" }), now)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.attendanceCorrection.count({ where: { employeeId: engineer.employee.id, status: "PENDING" } })).toBe(1);
  });

  it("shows the approver the reason and what was actually recorded that day", async () => {
    const { manager, engineer, me } = await org();
    await requestCorrection(await me(engineer), fix({ breakStart: "13:00", breakEnd: "13:30" }), now);
    const [item] = (await getInbox(await me(manager), now)).waiting;
    expect(item.detail).toBe("“Forgot to check in” · Break 13:00–13:30 · Recorded that day: nothing");
  });

  it("validates before creating anything", async () => {
    const { engineer, me } = await org();
    expect(await requestCorrection(await me(engineer), fix({ workDate: "2026-10-28" }), now)).toEqual({ ok: false, error: "Pick a day before today." });
    expect(await db.attendanceCorrection.count()).toBe(0);
  });
});
