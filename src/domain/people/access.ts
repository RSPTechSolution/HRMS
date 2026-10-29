import type { CurrentUser } from "@/domain/auth/types";

export type Visibility = "FULL" | "MASKED" | "NONE";

export type ProfileAccess = {
  level: "SELF" | "HR" | "PAYROLL" | "MANAGER" | "COLLEAGUE";
  personal: boolean;
  bank: Visibility;
  ids: Visibility;
  attendance: boolean;
  documents: boolean;
  edit: "FULL" | "SELF" | "NONE";
  audit: boolean;
  roles: boolean;
};

const NOTHING: Omit<ProfileAccess, "level"> = {
  personal: false, bank: "NONE", ids: "NONE", attendance: false, documents: false, edit: "NONE", audit: false, roles: false,
};

/** Who may see what on someone's profile (spec §5.1–§5.3, §13.12). */
export function profileAccess(viewer: CurrentUser, subjectEmployeeId: string, viewerManagesSubject: boolean): ProfileAccess {
  if (viewer.isHR || viewer.isAdmin) {
    return { level: "HR", personal: true, bank: "FULL", ids: "FULL", attendance: true, documents: true, edit: "FULL", audit: true, roles: viewer.isAdmin };
  }
  if (viewer.employeeId === subjectEmployeeId) {
    const sensitive: Visibility = viewer.isPayroll ? "FULL" : "MASKED";
    return { ...NOTHING, level: "SELF", personal: true, bank: sensitive, ids: sensitive, attendance: true, documents: true, edit: "SELF" };
  }
  if (viewer.isPayroll) return { ...NOTHING, level: "PAYROLL", bank: "FULL", ids: "FULL", attendance: viewerManagesSubject };
  if (viewerManagesSubject) return { ...NOTHING, level: "MANAGER", attendance: true };
  return { ...NOTHING, level: "COLLEAGUE" };
}

/** Bullets for everything but the last `keep` characters, grouped in fours: "•••• •••• 9012". */
export function maskTail(value: string | null, keep = 4): string | null {
  if (value === null) return null;
  if (value.length <= keep) return value;
  const hidden = value.length - keep;
  const groups: string[] = [];
  for (let i = 0; i < hidden; i += 4) groups.push("•".repeat(Math.min(4, hidden - i)));
  return `${groups.join(" ")} ${value.slice(-keep)}`;
}
