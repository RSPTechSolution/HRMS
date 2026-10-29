import "server-only";
import { db } from "@/lib/db";
import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import { buildOrgTree, type OrgNode } from "@/domain/people/hierarchy";
import { writeAudit } from "@/server/audit";

type Result = { ok: true; id: string } | { ok: false; error: string };
const DENIED: Result = { ok: false, error: "You don't have permission to do that." };

export function listDepartments() {
  return db.department.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { employees: { where: { status: { not: "EXITED" } } } } } } });
}

export function listDesignations() {
  return db.designation.findMany({ orderBy: [{ level: "desc" }, { title: "asc" }], include: { _count: { select: { employees: { where: { status: { not: "EXITED" } } } } } } });
}

async function saveName(
  actor: CurrentUser,
  kind: "Department" | "Designation",
  id: string | null,
  name: string,
  level?: number,
): Promise<Result> {
  if (!can(actor, "employees.manage")) return DENIED;
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) return { ok: false, error: "Use 2 to 60 characters." };
  if (level !== undefined && (!Number.isInteger(level) || level < 1 || level > 10)) return { ok: false, error: "Level is a whole number from 1 to 10." };
  const clash =
    kind === "Department"
      ? await db.department.findFirst({ where: { name: clean, NOT: id ? { id } : undefined } })
      : await db.designation.findFirst({ where: { title: clean, NOT: id ? { id } : undefined } });
  if (clash) return { ok: false, error: `A ${kind.toLowerCase()} with that name already exists.` };

  return db.$transaction(async (tx) => {
    const row =
      kind === "Department"
        ? id
          ? await tx.department.update({ where: { id }, data: { name: clean } })
          : await tx.department.create({ data: { name: clean } })
        : id
          ? await tx.designation.update({ where: { id }, data: { title: clean, level } })
          : await tx.designation.create({ data: { title: clean, level } });
    await writeAudit(tx, { actorId: actor.userId, action: `${kind.toLowerCase()}.${id ? "rename" : "create"}`, entityType: kind, entityId: row.id, after: { name: clean, level } });
    return { ok: true as const, id: row.id };
  });
}

export const createDepartment = (actor: CurrentUser, name: string) => saveName(actor, "Department", null, name);
export const renameDepartment = (actor: CurrentUser, id: string, name: string) => saveName(actor, "Department", id, name);
export const createDesignation = (actor: CurrentUser, title: string, level: number) => saveName(actor, "Designation", null, title, level);
export const renameDesignation = (actor: CurrentUser, id: string, title: string, level: number) => saveName(actor, "Designation", id, title, level);

export async function getOrgChart(): Promise<{
  nodes: Record<string, { id: string; fullName: string; designation: string | null; department: string | null }>;
  roots: OrgNode[];
}> {
  const people = await db.employee.findMany({
    where: { status: { not: "EXITED" } },
    select: { id: true, fullName: true, managerId: true, designation: { select: { title: true } }, department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });
  const managerOf = new Map(people.map((p) => [p.id, p.managerId]));
  return {
    nodes: Object.fromEntries(
      people.map((p) => [p.id, { id: p.id, fullName: p.fullName, designation: p.designation?.title ?? null, department: p.department?.name ?? null }]),
    ),
    roots: buildOrgTree(managerOf),
  };
}
