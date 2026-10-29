import "server-only";
import { db } from "@/lib/db";
import { dayLabel, istDateKey } from "@/lib/dates";
import type { CurrentUser } from "@/domain/auth/types";
import { correctionInputSchema, validateCorrection } from "@/domain/attendance/corrections";
import { submitApproval } from "@/server/approvals/engine";
import { registerApprovalType } from "@/server/approvals/registry";
import { getSettings } from "@/server/settings";
import { recomputeDay } from "./record";

export const CORRECTION_TYPE = "ATTENDANCE_CORRECTION";

registerApprovalType(CORRECTION_TYPE, {
  label: "Attendance fix",
  link: () => "/attendance",
  onApproved: async (tx, ref) => {
    const c = await tx.attendanceCorrection.findUniqueOrThrow({ where: { id: ref.subjectId } });
    await tx.attendanceEvent.deleteMany({ where: { employeeId: c.employeeId, workDate: c.workDate } });
    const events: { kind: string; at: Date }[] = [{ kind: "IN", at: c.inAt }];
    if (c.breakStartAt && c.breakEndAt) events.push({ kind: "BREAK_START", at: c.breakStartAt }, { kind: "BREAK_END", at: c.breakEndAt });
    events.push({ kind: "OUT", at: c.outAt });
    await tx.attendanceEvent.createMany({ data: events.map((e) => ({ ...e, employeeId: c.employeeId, workDate: c.workDate, source: "CORRECTION" })) });
    await tx.attendanceCorrection.update({ where: { id: c.id }, data: { status: "APPROVED" } });
    await recomputeDay(tx, c.employeeId, c.workDate, new Date());
  },
  onClosed: async (tx, ref, status) => {
    await tx.attendanceCorrection.update({ where: { id: ref.subjectId }, data: { status } });
  },
});

export async function requestCorrection(actor: CurrentUser, raw: unknown, now = new Date()): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = correctionInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const input = parsed.data;
  const [settings, open] = await Promise.all([
    getSettings(),
    db.attendanceCorrection.count({ where: { employeeId: actor.employeeId, workDate: input.workDate, status: "PENDING" } }),
  ]);
  const times = validateCorrection(input, { today: istDateKey(now), windowDays: settings["attendance.correctionWindowDays"], hasOpenCorrection: open > 0 });
  if (!times.ok) return times;

  const id = await db.$transaction(async (tx) => {
    const c = await tx.attendanceCorrection.create({
      data: {
        employeeId: actor.employeeId,
        workDate: input.workDate,
        inAt: times.inAt,
        outAt: times.outAt,
        breakStartAt: times.breakStartAt,
        breakEndAt: times.breakEndAt,
        reason: input.reason,
      },
    });
    await submitApproval(tx, {
      type: CORRECTION_TYPE,
      subjectId: c.id,
      requesterId: actor.employeeId,
      summary: `${dayLabel(input.workDate)} · ${input.inTime}–${input.outTime}`,
    });
    return c.id;
  });
  return { ok: true, id };
}

export async function listMyCorrections(employeeId: string) {
  const corrections = await db.attendanceCorrection.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" }, take: 20 });
  const approvals = await db.approvalRequest.findMany({
    where: { type: CORRECTION_TYPE, subjectId: { in: corrections.map((c) => c.id) } },
    select: { id: true, subjectId: true, summary: true },
  });
  const bySubject = new Map(approvals.map((a) => [a.subjectId, a]));
  return corrections.map((c) => ({
    id: c.id,
    workDate: c.workDate,
    status: c.status,
    reason: c.reason,
    summary: bySubject.get(c.id)?.summary ?? dayLabel(c.workDate),
    approvalId: bySubject.get(c.id)?.id ?? null,
  }));
}
