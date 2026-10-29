import { describe, expect, it } from "vitest";
import { can, primaryRoleLabel } from "@/domain/auth/permissions";
import { isActivePath, navFor } from "@/components/shell/nav";
import type { CurrentUser } from "@/domain/auth/types";

const base: CurrentUser = {
  userId: "u",
  employeeId: "e",
  email: "a@lnwebworks.test",
  fullName: "A B",
  isHR: false,
  isPayroll: false,
  isAdmin: false,
  isManager: false,
};

describe("can", () => {
  it("gives employees no admin capabilities", () => {
    for (const action of ["settings.manage", "audit.view", "employees.manage", "payroll.manage", "approvals.hr"] as const) {
      expect(can(base, action)).toBe(false);
    }
  });
  it("lets HR manage people and act on HR approvals but not settings or payroll", () => {
    const hr = { ...base, isHR: true };
    expect(can(hr, "employees.manage")).toBe(true);
    expect(can(hr, "approvals.hr")).toBe(true);
    expect(can(hr, "audit.view")).toBe(true);
    expect(can(hr, "settings.manage")).toBe(false);
    expect(can(hr, "payroll.manage")).toBe(false);
  });
  it("lets payroll manage payroll only", () => {
    const p = { ...base, isPayroll: true };
    expect(can(p, "payroll.manage")).toBe(true);
    expect(can(p, "employees.manage")).toBe(false);
  });
  it("lets admins do everything", () => {
    const a = { ...base, isAdmin: true };
    for (const action of ["settings.manage", "audit.view", "employees.manage", "payroll.manage", "approvals.hr"] as const) {
      expect(can(a, action)).toBe(true);
    }
  });
});

describe("primaryRoleLabel", () => {
  it("picks the most senior role", () => {
    expect(primaryRoleLabel(base)).toBe("Employee");
    expect(primaryRoleLabel({ ...base, isManager: true })).toBe("Manager");
    expect(primaryRoleLabel({ ...base, isManager: true, isPayroll: true })).toBe("Payroll");
    expect(primaryRoleLabel({ ...base, isHR: true, isPayroll: true })).toBe("HR");
    expect(primaryRoleLabel({ ...base, isHR: true, isAdmin: true })).toBe("Admin");
  });
});

describe("navigation", () => {
  it("shows Settings to admins only", () => {
    expect(navFor(base).map((l) => l.href)).toEqual(["/home", "/attendance", "/people", "/approvals", "/profile"]);
    expect(navFor({ ...base, isManager: true }).map((l) => l.href)).toEqual(["/home", "/attendance", "/people", "/approvals", "/reports/attendance", "/profile"]);
    expect(navFor({ ...base, isHR: true }).map((l) => l.href)).toEqual(["/home", "/attendance", "/people", "/approvals", "/reports/attendance", "/profile"]);
    expect(navFor({ ...base, isAdmin: true }).map((l) => l.href)).toEqual(["/home", "/attendance", "/people", "/approvals", "/reports/attendance", "/profile", "/settings"]);
  });
  it("shows a badge with the number of approvals waiting", () => {
    expect(navFor(base, 3).find((l) => l.href === "/approvals")?.badge).toBe(3);
    expect(navFor(base, 0).find((l) => l.href === "/approvals")?.badge).toBeUndefined();
  });
  it("matches nested paths but not prefixes of other words", () => {
    expect(isActivePath("/settings", "/settings")).toBe(true);
    expect(isActivePath("/settings/roles", "/settings")).toBe(true);
    expect(isActivePath("/settingsx", "/settings")).toBe(false);
  });
});
