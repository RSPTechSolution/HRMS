import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";

export async function loadCurrentUser(userId: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      employee: { include: { _count: { select: { reports: { where: { status: { not: "EXITED" } } } } } } },
    },
  });
  if (!user || user.employee.status === "EXITED") return null;
  return {
    userId: user.id,
    employeeId: user.employeeId,
    email: user.email,
    fullName: user.employee.fullName,
    isHR: user.isHR,
    isPayroll: user.isPayroll,
    isAdmin: user.isAdmin,
    isManager: user.employee._count.reports > 0,
  };
}
