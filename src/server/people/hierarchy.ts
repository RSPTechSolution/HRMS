import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";
import { isInChain, reportsOf, type ManagerMap } from "@/domain/people/hierarchy";
import type { Db } from "@/server/db-types";

export async function loadManagerMap(client: Db = db): Promise<ManagerMap> {
  const rows = await client.employee.findMany({ select: { id: true, managerId: true } });
  return new Map(rows.map((r) => [r.id, r.managerId]));
}

/** True when `managerEmployeeId` is anywhere above `employeeId`. */
export async function managesEmployee(managerEmployeeId: string, employeeId: string): Promise<boolean> {
  return isInChain(managerEmployeeId, employeeId, await loadManagerMap());
}

/** Whose team data the viewer may see: everyone for HR/Admin, their whole reporting line for managers. */
export async function visibleReportIds(viewer: CurrentUser): Promise<string[] | "ALL"> {
  if (viewer.isHR || viewer.isAdmin) return "ALL";
  if (!viewer.isManager) return [];
  return reportsOf(viewer.employeeId, await loadManagerMap());
}
