import { beforeEach, describe, expect, it } from "vitest";
import "@/server/approvals/types";
import { db } from "@/lib/db";
import { istDateTime } from "@/lib/dates";
import { getHomeView } from "@/server/home";
import { loadCurrentUser } from "@/server/auth/users";
import { recordAttendance } from "@/server/attendance/record";
import { requestCorrection } from "@/server/attendance/corrections";
import { makeEmployee, resetDb } from "../helpers/db";

describe("getHomeView", () => {
  beforeEach(resetDb);

  it("greets by first name in IST and lists the latest notifications", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    await db.notification.create({ data: { userId: user.id, kind: "k", title: "Hello", createdAt: new Date("2026-10-28T03:18:00Z") } });
    const view = await getHomeView((await loadCurrentUser(user.id))!, new Date("2026-10-28T03:30:00Z"));
    expect(view).toMatchObject({
      dateLabel: "Wednesday 28 October",
      heading: "Good morning, Arjun.",
      notes: [{ id: expect.any(String), title: "Hello", ago: "12 min ago" }],
      team: null,
    });
  });

  it("shows today's live attendance, recent hours and what needs reviewing", async () => {
    await db.approvalPolicy.create({ data: { type: "ATTENDANCE_CORRECTION", steps: JSON.stringify(["MANAGER"]) } });
    const manager = await makeEmployee({ name: "Ananya Sharma" });
    const engineer = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
    const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
    await recordAttendance(await me(engineer), "IN", istDateTime("2026-10-28", "09:30"));
    await requestCorrection(await me(engineer), { workDate: "2026-10-27", inTime: "09:30", outTime: "18:30", reason: "Forgot to check in" }, istDateTime("2026-10-28", "10:00"));

    const now = istDateTime("2026-10-28", "11:00");
    const mine = await getHomeView(await me(engineer), now);
    expect(mine.today).toMatchObject({ state: "WORKING", workedMinutes: 90 });
    expect(mine.recent).toHaveLength(10);
    expect(mine.kpis.toReview).toBe(0);

    const boss = await getHomeView(await me(manager), now);
    expect(boss.kpis.toReview).toBe(1);
    expect(boss.team?.counts.in).toBe(1);
  });
});
