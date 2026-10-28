import { STEP_ROLES, type PlannedStep, type StepRole } from "./types";

export function parsePolicySteps(json: string): StepRole[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid approval policy steps: ${json}`);
  }
  const valid =
    Array.isArray(parsed) && parsed.length > 0 && parsed.every((s) => (STEP_ROLES as readonly unknown[]).includes(s));
  if (!valid) throw new Error(`Invalid approval policy steps: ${json}`);
  return parsed as StepRole[];
}

/**
 * Turns a policy into concrete steps for one requester. MANAGER steps are skipped when there is no
 * (other) manager; if nothing is left, a single HR step is used so every request has an approver.
 */
export function planSteps(policy: StepRole[], requester: { employeeId: string; managerId: string | null }): PlannedStep[] {
  const steps: { role: StepRole; approverId: string | null }[] = [];
  for (const role of policy) {
    if (role === "MANAGER") {
      if (requester.managerId && requester.managerId !== requester.employeeId) steps.push({ role, approverId: requester.managerId });
    } else if (!steps.some((s) => s.role === "HR")) {
      steps.push({ role, approverId: null });
    }
  }
  if (steps.length === 0) steps.push({ role: "HR", approverId: null });
  return steps.map((s, order) => ({ order, ...s }));
}
