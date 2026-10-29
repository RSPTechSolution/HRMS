import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { istDateKey } from "@/lib/dates";
import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import { wouldCreateCycle } from "@/domain/people/hierarchy";
import { makeEmployeeInputSchema, selfEditSchema, type EmployeeInput } from "@/domain/people/schemas";
import { writeAudit } from "@/server/audit";
import { sendSetPasswordEmail } from "@/server/auth/password-tokens";
import type { DbTx } from "@/server/db-types";
import { loadManagerMap } from "./hierarchy";

export type EmployeeResult = { ok: true; id: string } | { ok: false; error: string; field?: string };

const DENIED = { ok: false, error: "You don't have permission to do that." } as const;
const SENSITIVE = ["bankHolder", "bankAccount", "bankIfsc", "pan", "aadhaar"] as const;
type EmployeeData = Omit<EmployeeInput, "isHR" | "isPayroll" | "isAdmin">;

function firstIssue(error: z.ZodError): EmployeeResult {
  const issue = error.issues[0];
  return { ok: false, error: issue?.message ?? "Check the form and try again.", field: issue ? String(issue.path[0] ?? "") : undefined };
}

/** Audit-safe copy: sensitive values never reach the audit log. */
function publicPart(data: Partial<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([k]) => !(SENSITIVE as readonly string[]).includes(k) && k !== "createdAt" && k !== "updatedAt"));
}

async function nextCode(tx: DbTx): Promise<string> {
  const rows = await tx.employee.findMany({ where: { code: { startsWith: "LNW-" } }, select: { code: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(4)) || 0), 0);
  return `LNW-${String(max + 1).padStart(4, "0")}`;
}

async function checkReferences(data: EmployeeData, selfId: string | null): Promise<EmployeeResult | null> {
  const emailOwner = await db.user.findUnique({ where: { email: data.workEmail }, select: { employeeId: true } });
  if (emailOwner && emailOwner.employeeId !== selfId) return { ok: false, error: "Someone already uses that work email.", field: "workEmail" };
  if (!(await db.designation.findUnique({ where: { id: data.designationId } }))) return { ok: false, error: "Pick a designation.", field: "designationId" };
  if (!(await db.department.findUnique({ where: { id: data.departmentId } }))) return { ok: false, error: "Pick a department.", field: "departmentId" };
  if (data.managerId) {
    const manager = await db.employee.findUnique({ where: { id: data.managerId }, select: { status: true } });
    if (!manager || manager.status === "EXITED") return { ok: false, error: "Pick a current employee as manager.", field: "managerId" };
  }
  return null;
}

export async function createEmployee(actor: CurrentUser, raw: unknown, now = new Date()): Promise<EmployeeResult> {
  if (!can(actor, "employees.manage")) return DENIED;
  const parsed = makeEmployeeInputSchema(istDateKey(now)).safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const { isHR, isPayroll, isAdmin, ...data } = parsed.data;
  const refError = await checkReferences(data, null);
  if (refError) return refError;
  const roles = actor.isAdmin ? { isHR, isPayroll, isAdmin } : { isHR: false, isPayroll: false, isAdmin: false };

  const id = await db.$transaction(async (tx) => {
    const employee = await tx.employee.create({ data: { ...data, code: await nextCode(tx) } });
    await tx.user.create({ data: { email: data.workEmail, employeeId: employee.id, ...roles } });
    await writeAudit(tx, { actorId: actor.userId, action: "employee.create", entityType: "Employee", entityId: employee.id, after: { ...publicPart(data), ...roles } });
    return employee.id;
  });
  return { ok: true, id };
}

/**
 * Sends the set-password invite — only to accounts that have never set a password, so it can't be used
 * to reset someone's existing login. Callers run this after the response with `after()`.
 */
export async function sendInvite(employeeId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { employeeId }, select: { id: true, passwordHash: true, employee: { select: { status: true } } } });
  if (user && !user.passwordHash && user.employee.status !== "EXITED") await sendSetPasswordEmail(user.id);
}

export async function updateEmployee(actor: CurrentUser, id: string, raw: unknown, now = new Date()): Promise<EmployeeResult> {
  if (!can(actor, "employees.manage")) return DENIED;
  const parsed = makeEmployeeInputSchema(istDateKey(now)).safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const { isHR, isPayroll, isAdmin, ...data } = parsed.data;
  const found = await db.employee.findUnique({ where: { id }, include: { user: true } });
  if (!found || !found.user) return { ok: false, error: "That person doesn't exist." };
  // Keep the login row (password hash!) out of everything below, including the audit snapshot.
  const { user: targetUser, ...existing } = found;
  // Only admins may change an admin: otherwise HR could redirect an admin's login email and reset the password.
  if (targetUser.isAdmin && !actor.isAdmin) return { ok: false, error: "Only an admin can change an admin's details." };
  // The work email is the login: letting HR change it would let them reset and use anyone's account.
  if (data.workEmail !== targetUser.email && !actor.isAdmin) {
    return { ok: false, error: "Only an admin can change someone's work email.", field: "workEmail" };
  }
  const refError = await checkReferences(data, id);
  if (refError) return refError;
  if (wouldCreateCycle(id, data.managerId, await loadManagerMap())) {
    return { ok: false, error: "That would make them report to themselves.", field: "managerId" };
  }

  const changedSensitive = Object.fromEntries(SENSITIVE.filter((k) => existing[k] !== data[k]).map((k) => [k, "changed"]));
  const exiting = data.status === "EXITED" && existing.status !== "EXITED";
  const emailChanged = data.workEmail !== targetUser.email;
  const userId = targetUser.id;
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id }, data });
    await tx.user.update({ where: { id: userId }, data: { email: data.workEmail, ...(actor.isAdmin ? { isHR, isPayroll, isAdmin } : {}) } });
    if (exiting) await tx.session.deleteMany({ where: { userId } });
    if (exiting || emailChanged) {
      // Links already mailed to the old address (or to someone leaving) must stop working.
      await tx.passwordToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    }
    await writeAudit(tx, {
      actorId: actor.userId,
      action: "employee.update",
      entityType: "Employee",
      entityId: id,
      before: publicPart(existing),
      after: { ...publicPart(data), ...changedSensitive },
    });
  });
  return { ok: true, id };
}

/** Employees change only their own contact details; fields not sent are left alone. */
export async function updateMyDetails(actor: CurrentUser, raw: unknown): Promise<EmployeeResult> {
  const parsed = selfEditSchema.safeParse(raw);
  if (!parsed.success) return firstIssue(parsed.error);
  const sent = new Set(Object.keys((raw ?? {}) as object));
  const data = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => sent.has(k)));
  const before = await db.employee.findUniqueOrThrow({ where: { id: actor.employeeId } });
  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: actor.employeeId }, data });
    await writeAudit(tx, {
      actorId: actor.userId,
      action: "employee.self_update",
      entityType: "Employee",
      entityId: actor.employeeId,
      before: Object.fromEntries(Object.keys(data).map((k) => [k, before[k as keyof typeof before]])),
      after: data,
    });
  });
  return { ok: true, id: actor.employeeId };
}
