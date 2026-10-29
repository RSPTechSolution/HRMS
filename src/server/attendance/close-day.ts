import "server-only";
import { db } from "@/lib/db";
import { addDays, dayLabel } from "@/lib/dates";
import { notifyEmployees } from "@/server/notifications";
import { loadDayContext, recomputeDay, type DayContext } from "./record";

/** How far back a run looks for days an earlier run had to leave "in progress". */
const CATCH_UP_DAYS = 7;

async function closeOne(employeeId: string, workDate: string, now: Date, ctx: DayContext, counts: { missingCheckout: number; absent: number }) {
  await db.$transaction(async (tx) => {
    const before = await tx.attendanceDay.findUnique({ where: { employeeId_workDate: { employeeId, workDate } }, select: { status: true } });
    const status = await recomputeDay(tx, employeeId, workDate, now, ctx);
    if (status === before?.status) return;
    const label = dayLabel(workDate);
    if (status === "MISSING_CHECKOUT") {
      counts.missingCheckout += 1;
      await notifyEmployees(tx, [employeeId], { kind: "attendance.missing_checkout", title: `You didn't check out on ${label}. Ask for a correction.`, link: "/attendance" });
    } else if (status === "ABSENT") {
      counts.absent += 1;
      await notifyEmployees(tx, [employeeId], { kind: "attendance.absent", title: `No attendance for ${label}. If you worked, ask for a correction.`, link: "/attendance" });
    }
  });
}

/**
 * Finalises a past day for everyone employed on it, and tells people about a missed check-out or an
 * absence. A session checked in after 08:30 is still under 16 hours old at the 00:30 run, so every run
 * also re-closes recent days it had to leave IN_PROGRESS. Safe to run more than once: people are only
 * notified when their status changes to one of those.
 */
export async function closeAttendanceDay(workDate: string, now = new Date()): Promise<{ missingCheckout: number; absent: number }> {
  const ctx = await loadDayContext();
  const counts = { missingCheckout: 0, absent: 0 };

  const stillOpen = await db.attendanceDay.findMany({
    where: { status: "IN_PROGRESS", workDate: { lt: workDate, gte: addDays(workDate, -CATCH_UP_DAYS) } },
    select: { employeeId: true, workDate: true },
    orderBy: { workDate: "asc" },
  });
  for (const row of stillOpen) await closeOne(row.employeeId, row.workDate, now, ctx, counts);

  const employees = await db.employee.findMany({
    where: { status: { in: ["ACTIVE", "NOTICE"] }, joinedOn: { lte: workDate } },
    select: { id: true },
  });
  for (const { id } of employees) await closeOne(id, workDate, now, ctx, counts);
  return counts;
}
