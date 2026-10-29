import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";
import { maskTail, profileAccess, type ProfileAccess } from "@/domain/people/access";
import { isInChain } from "@/domain/people/hierarchy";
import type { EmployeeStatus, EmploymentType } from "@/domain/people/types";
import { loadManagerMap } from "./hierarchy";

export type TodayPresence = "IN" | "BREAK" | "OUT" | "NOT_IN";

export type DirectoryEntry = {
  id: string;
  code: string;
  fullName: string;
  designation: string | null;
  department: string | null;
  departmentId: string | null;
  location: string;
  status: EmployeeStatus;
  email: string;
  today: TodayPresence;
};

export async function getDirectory(
  viewer: CurrentUser,
  filter: { q?: string; departmentId?: string; includeExited?: boolean },
  todayOf: (ids: string[]) => Promise<Map<string, TodayPresence>> = async () => new Map(),
): Promise<DirectoryEntry[]> {
  const showExited = !!filter.includeExited && (viewer.isHR || viewer.isAdmin);
  const rows = await db.employee.findMany({
    where: { ...(showExited ? {} : { status: { not: "EXITED" } }), ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
    select: {
      id: true, code: true, fullName: true, location: true, status: true, workEmail: true, departmentId: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });
  const q = filter.q?.trim().toLowerCase();
  const matching = q
    ? rows.filter((r) => [r.fullName, r.code, r.designation?.title ?? "", r.workEmail].some((v) => v.toLowerCase().includes(q)))
    : rows;
  const today = await todayOf(matching.map((r) => r.id));
  return matching.map((r) => ({
    id: r.id,
    code: r.code,
    fullName: r.fullName,
    designation: r.designation?.title ?? null,
    department: r.department?.name ?? null,
    departmentId: r.departmentId,
    location: r.location,
    status: r.status as EmployeeStatus,
    email: r.workEmail,
    today: today.get(r.id) ?? "NOT_IN",
  }));
}

export type ProfileView = {
  id: string;
  code: string;
  fullName: string;
  preferredName: string | null;
  email: string;
  designation: string | null;
  designationId: string | null;
  department: string | null;
  departmentId: string | null;
  managerId: string | null;
  managerName: string | null;
  location: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  joinedOn: string;
  probationEndsOn: string | null;
  access: ProfileAccess;
  roles?: { isHR: boolean; isPayroll: boolean; isAdmin: boolean };
  personal?: {
    personalEmail: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    bloodGroup: string | null;
    currentAddress: string | null;
    permanentAddress: string | null;
    emergencyName: string | null;
    emergencyRelation: string | null;
    emergencyPhone: string | null;
    showBirthday: boolean;
  };
  bank?: { holder: string | null; account: string | null; ifsc: string | null };
  ids?: { pan: string | null; aadhaar: string | null };
};

/** Builds exactly what this viewer may see. Sensitive groups are left out entirely, not nulled. */
export async function getProfile(viewer: CurrentUser, employeeId: string): Promise<ProfileView | null> {
  const e = await db.employee.findUnique({
    where: { id: employeeId },
    include: { designation: true, department: true, manager: { select: { fullName: true } }, user: true },
  });
  if (!e) return null;
  const hrLike = viewer.isHR || viewer.isAdmin;
  if (e.status === "EXITED" && !hrLike) return null;
  const manages = isInChain(viewer.employeeId, e.id, await loadManagerMap());
  const access = profileAccess(viewer, e.id, manages);

  const view: ProfileView = {
    id: e.id,
    code: e.code,
    fullName: e.fullName,
    preferredName: e.preferredName,
    email: e.workEmail,
    designation: e.designation?.title ?? null,
    designationId: e.designationId,
    department: e.department?.name ?? null,
    departmentId: e.departmentId,
    managerId: e.managerId,
    managerName: e.manager?.fullName ?? null,
    location: e.location,
    employmentType: e.employmentType as EmploymentType,
    status: e.status as EmployeeStatus,
    joinedOn: e.joinedOn,
    probationEndsOn: e.probationEndsOn,
    access,
  };
  if (hrLike && e.user) view.roles = { isHR: e.user.isHR, isPayroll: e.user.isPayroll, isAdmin: e.user.isAdmin };
  if (access.personal) {
    view.personal = {
      personalEmail: e.personalEmail,
      phone: e.phone,
      dateOfBirth: e.dateOfBirth,
      gender: e.gender,
      bloodGroup: e.bloodGroup,
      currentAddress: e.currentAddress,
      permanentAddress: e.permanentAddress,
      emergencyName: e.emergencyName,
      emergencyRelation: e.emergencyRelation,
      emergencyPhone: e.emergencyPhone,
      showBirthday: e.showBirthday,
    };
  }
  if (access.bank !== "NONE") {
    const full = access.bank === "FULL";
    view.bank = { holder: e.bankHolder, account: full ? e.bankAccount : maskTail(e.bankAccount), ifsc: e.bankIfsc };
  }
  if (access.ids !== "NONE") {
    const full = access.ids === "FULL";
    view.ids = { pan: full ? e.pan : maskTail(e.pan), aadhaar: full ? e.aadhaar : maskTail(e.aadhaar) };
  }
  return view;
}
