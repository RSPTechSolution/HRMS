import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { istDateTime } from "@/lib/dates";
import { loadCurrentUser } from "@/server/auth/users";
import { recordAttendance } from "@/server/attendance/record";
import { attendanceCsvResponse, getMonthlyReport, reportToCsv, type ReportRow } from "@/server/attendance/report";
import { makeEmployee, resetDb } from "../helpers/db";

const now = istDateTime("2026-10-28", "12:00");

async function org() {
  const hr = await makeEmployee({ name: "Neha Verma", isHR: true });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const engineer = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const colleague = await makeEmployee({ name: "Riya Kapoor" });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  await recordAttendance(await me(engineer), "IN", istDateTime("2026-10-26", "09:30"));
  await recordAttendance(await me(engineer), "OUT", istDateTime("2026-10-26", "18:45"));
  return { hr, manager, engineer, colleague, me };
}

describe("monthly attendance report", () => {
  beforeEach(resetDb);

  it("counts each person's month for HR", async () => {
    const { hr, engineer, me } = await org();
    const rows = (await getMonthlyReport(await me(hr), 2026, 10, now))!;
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.employeeId === engineer.employee.id)).toMatchObject({
      fullName: "Arjun Mehta", present: 1, absent: 18, short: 0, halfDay: 0, holidays: 0, missingCheckout: 0, leave: 0, wfh: 0, totalMinutes: 555, averageMinutes: 555,
    });
  });

  it("keeps people who have since left in the months they worked", async () => {
    const { hr, engineer, me } = await org();
    await db.employee.update({ where: { id: engineer.employee.id }, data: { status: "EXITED" } });
    const rows = (await getMonthlyReport(await me(hr), 2026, 10, now))!;
    expect(rows.find((r) => r.employeeId === engineer.employee.id)?.present).toBe(1);
    expect((await getMonthlyReport(await me(hr), 2026, 9, now))!.some((r) => r.employeeId === engineer.employee.id)).toBe(false);
  });

  it("shows managers their team only and nobody else gets a report", async () => {
    const { manager, engineer, colleague, me } = await org();
    expect((await getMonthlyReport(await me(manager), 2026, 10, now))!.map((r) => r.employeeId)).toEqual([engineer.employee.id]);
    expect(await getMonthlyReport(await me(colleague), 2026, 10, now)).toBeNull();
  });

  it("writes safe CSV", () => {
    const row: ReportRow = {
      employeeId: "e", code: "LNW-0047", fullName: 'Ravi "RP" Prakash', department: "=SUM(A1)",
      present: 1, short: 0, halfDay: 0, absent: 2, leave: 0, wfh: 0, holidays: 1, missingCheckout: 0, totalMinutes: 555, averageMinutes: 555,
    };
    const csv = reportToCsv([row]);
    const [header, line] = csv.trim().split("\r\n");
    expect(header).toBe("Code,Name,Department,Present,Short,Half day,Absent,Leave,WFH,Holidays,Missing check-out,Total hours,Average hours");
    expect(line).toBe('"LNW-0047","Ravi ""RP"" Prakash","\'=SUM(A1)","1","0","0","2","0","0","1","0","9:15","9:15"');
  });

  it("answers the CSV download with the right status codes", async () => {
    const { hr, colleague, me } = await org();
    expect((await attendanceCsvResponse(null, "2026-10", now)).status).toBe(401);
    expect((await attendanceCsvResponse(await me(colleague), "2026-10", now)).status).toBe(403);
    expect((await attendanceCsvResponse(await me(hr), "2026-13", now)).status).toBe(400);
    const ok = await attendanceCsvResponse(await me(hr), "2026-10", now);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(ok.headers.get("content-disposition")).toBe('attachment; filename="attendance-2026-10.csv"');
    expect(await ok.text()).toContain("Arjun Mehta");
  });
});
