import "server-only";
import { db } from "@/lib/db";

export async function getMyProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { employee: { include: { department: true, manager: true } } },
  });
  if (!user) return null;
  const e = user.employee;
  return {
    fullName: e.fullName,
    email: user.email,
    code: e.code,
    designation: e.designation,
    department: e.department?.name ?? null,
    managerName: e.manager?.fullName ?? null,
    joinedOn: e.joinedOn,
  };
}
