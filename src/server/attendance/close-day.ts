import "server-only";
import { db } from "@/lib/db";
import { dayLabel } from "@/lib/dates";
import { notifyEmployees } from "@/server/notifications";
import { loadDayContext, recomputeDay } from "./record";

/**
 * Finalises a past day for everyone employed on it, and tells people about a missed check-out or an
 * absence. Safe to run more than once: people are only notified when their status changes to one of those.
 */
export async function closeAttendanceDay(workDate: string, now = new Date()): Promise<{ missingCheckout: number; absent: number }> {
  const ctx = await loadDayContext();
  const employees = await db.employee.findMany({
    where: { status: { in: ["ACTIVE", "NOTICE"] }, joinedOn: { lte: workDate } },
    select: { id: true },
  });
  const label = dayLabel(workDate);
  let missingCheckout = 0;
  let absent = 0;
  for (const { id } of employees) {
    await db.$transaction(async (tx) => {
      const before = await tx.attendanceDay.findUnique({ where: { employeeId_workDate: { employeeId: id, workDate } }, select: { status: true } });
      const status = await recomputeDay(tx, id, workDate, now, ctx);
      if (status === before?.status) return;
      if (status === "MISSING_CHECKOUT") {
        missingCheckout += 1;
        await notifyEmployees(tx, [id], { kind: "attendance.missing_checkout", title: `You didn't check out on ${label}. Ask for a correction.`, link: "/attendance" });
      } else if (status === "ABSENT") {
        absent += 1;
        await notifyEmployees(tx, [id], { kind: "attendance.absent", title: `No attendance for ${label}. If you worked, ask for a correction.`, link: "/attendance" });
      }
    });
  }
  return { missingCheckout, absent };
}
