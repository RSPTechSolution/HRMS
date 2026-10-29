import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";
import type { DayStatus } from "@/domain/attendance/types";
import { visibleReportIds } from "@/server/people/hierarchy";
import { loadDayContext } from "./record";
import { buildMonthDays } from "./views";

export type ReportRow = {
  employeeId: string;
  code: string;
  fullName: string;
  department: string | null;
  present: number;
  short: number;
  halfDay: number;
  absent: number;
  leave: number;
  wfh: number;
  holidays: number;
  missingCheckout: number;
  totalMinutes: number;
  averageMinutes: number;
};

/** HR/Admin: everyone employed; managers: their whole reporting line; others: null. */
export async function getMonthlyReport(viewer: CurrentUser, year: number, month: number, now = new Date()): Promise<ReportRow[] | null> {
  const visible = await visibleReportIds(viewer);
  if (visible !== "ALL" && visible.length === 0) return null;
  const people = await db.employee.findMany({
    where: { status: { in: ["ACTIVE", "NOTICE"] }, ...(visible === "ALL" ? {} : { id: { in: visible } }) },
    select: { id: true, code: true, fullName: true, joinedOn: true, department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });
  const ctx = await loadDayContext();
  const rows: ReportRow[] = [];
  for (const p of people) {
    const { days, stats } = await buildMonthDays(p.id, year, month, now, { ...ctx, joinedOn: p.joinedOn });
    const counted = days.filter((d) => !d.beforeJoining);
    const count = (s: DayStatus) => counted.filter((d) => d.status === s).length;
    rows.push({
      employeeId: p.id,
      code: p.code,
      fullName: p.fullName,
      department: p.department?.name ?? null,
      present: count("PRESENT"),
      short: count("SHORT"),
      halfDay: count("HALF_DAY"),
      absent: count("ABSENT"),
      leave: count("LEAVE"),
      wfh: 0,
      holidays: count("HOLIDAY"),
      missingCheckout: count("MISSING_CHECKOUT"),
      totalMinutes: counted.reduce((sum, d) => sum + d.workedMinutes, 0),
      averageMinutes: stats.averageMinutes,
    });
  }
  return rows;
}

const hours = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/** Quotes every cell and neutralises values a spreadsheet would run as a formula. */
function cell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function reportToCsv(rows: ReportRow[]): string {
  const header = "Code,Name,Department,Present,Short,Half day,Absent,Leave,WFH,Holidays,Missing check-out,Total hours,Average hours";
  const lines = rows.map((r) =>
    [r.code, r.fullName, r.department, r.present, r.short, r.halfDay, r.absent, r.leave, r.wfh, r.holidays, r.missingCheckout, hours(r.totalMinutes), hours(r.averageMinutes)]
      .map(cell)
      .join(","),
  );
  return `${[header, ...lines].join("\r\n")}\r\n`;
}

/** The download behind /api/reports/attendance — kept here so it is testable without a request. */
export async function attendanceCsvResponse(viewer: CurrentUser | null, monthParam: string | null, now = new Date()): Promise<Response> {
  if (!viewer) return new Response("Sign in first.", { status: 401 });
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
  const year = match ? Number(match[1]) : NaN;
  const month = match ? Number(match[2]) : NaN;
  if (!match || month < 1 || month > 12) return new Response("Use ?month=YYYY-MM.", { status: 400 });
  const rows = await getMonthlyReport(viewer, year, month, now);
  if (!rows) return new Response("You can't download this report.", { status: 403 });
  return new Response(reportToCsv(rows), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="attendance-${match[1]}-${match[2]}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
