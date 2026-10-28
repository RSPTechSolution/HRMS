import type { PrismaClient } from "@/generated/prisma/client";

/** Deletes every row, children first. Later phases add their tables at the top of this list. */
export async function clearAll(db: PrismaClient): Promise<void> {
  await db.approvalStep.deleteMany();
  await db.approvalRequest.deleteMany();
  await db.approvalPolicy.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.setting.deleteMany();
  await db.passwordToken.deleteMany();
  await db.session.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.user.deleteMany();
  await db.employee.updateMany({ data: { managerId: null } });
  await db.employee.deleteMany();
  await db.department.deleteMany();
}
