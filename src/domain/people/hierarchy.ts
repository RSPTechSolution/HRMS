export type ManagerMap = Map<string, string | null>;
export type OrgNode = { id: string; children: OrgNode[] };

/** True when `managerId` is anywhere above `employeeId` in the reporting line. Safe on corrupt cycles. */
export function isInChain(managerId: string, employeeId: string, managerOf: ManagerMap): boolean {
  const seen = new Set<string>();
  let current = managerOf.get(employeeId) ?? null;
  while (current && !seen.has(current)) {
    if (current === managerId) return true;
    seen.add(current);
    current = managerOf.get(current) ?? null;
  }
  return false;
}

/** Would making `newManagerId` the manager of `employeeId` create a loop (including self-management)? */
export function wouldCreateCycle(employeeId: string, newManagerId: string | null, managerOf: ManagerMap): boolean {
  if (!newManagerId) return false;
  if (newManagerId === employeeId) return true;
  return isInChain(employeeId, newManagerId, managerOf);
}

/** Everyone below `managerId`, at every level. */
export function reportsOf(managerId: string, managerOf: ManagerMap): string[] {
  return [...managerOf.keys()].filter((id) => id !== managerId && isInChain(managerId, id, managerOf));
}

/** Roots are people with no manager (or whose manager is not in the map). Children keep map order. */
export function buildOrgTree(managerOf: ManagerMap): OrgNode[] {
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const [id, manager] of managerOf) {
    if (manager && managerOf.has(manager)) children.set(manager, [...(children.get(manager) ?? []), id]);
    else roots.push(id);
  }
  const visited = new Set<string>();
  const build = (id: string): OrgNode => {
    visited.add(id);
    return { id, children: (children.get(id) ?? []).filter((c) => !visited.has(c)).map(build) };
  };
  return roots.map(build);
}
