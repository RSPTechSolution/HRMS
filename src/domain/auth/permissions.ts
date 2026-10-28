import type { CurrentUser } from "./types";

export type Action = "settings.manage" | "audit.view" | "employees.manage" | "payroll.manage" | "approvals.hr";
type RoleFlags = Pick<CurrentUser, "isHR" | "isPayroll" | "isAdmin">;

const RULES: Record<Action, (u: RoleFlags) => boolean> = {
  "settings.manage": (u) => u.isAdmin,
  "audit.view": (u) => u.isHR || u.isAdmin,
  "employees.manage": (u) => u.isHR || u.isAdmin,
  "payroll.manage": (u) => u.isPayroll || u.isAdmin,
  "approvals.hr": (u) => u.isHR || u.isAdmin,
};

export function can(user: RoleFlags, action: Action): boolean {
  return RULES[action](user);
}

export function primaryRoleLabel(
  user: Pick<CurrentUser, "isHR" | "isPayroll" | "isAdmin" | "isManager">,
): "Admin" | "HR" | "Payroll" | "Manager" | "Employee" {
  if (user.isAdmin) return "Admin";
  if (user.isHR) return "HR";
  if (user.isPayroll) return "Payroll";
  if (user.isManager) return "Manager";
  return "Employee";
}
