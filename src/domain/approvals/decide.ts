import type { Actor, Decision, Outcome, RequestState, StepState } from "./types";

export function currentStepOf(state: RequestState): StepState | undefined {
  return state.steps.find((s) => s.order === state.currentStep);
}

export function canAct(state: RequestState, actor: Actor): boolean {
  if (state.status !== "PENDING") return false;
  if (actor.employeeId === state.requesterId) return false;
  if (state.steps.some((s) => s.decidedById === actor.employeeId)) return false;
  const step = currentStepOf(state);
  if (!step) return false;
  const hrLike = actor.isHR || actor.isAdmin;
  return step.role === "MANAGER" ? step.approverId === actor.employeeId || hrLike : hrLike;
}

/**
 * True when the current step is genuinely this person's job: the named manager on a MANAGER step, or
 * HR/Admin on an HR step. HR may still override a MANAGER step (canAct), but that is not "waiting on" them.
 */
export function isWaitingOn(state: RequestState, actor: Actor): boolean {
  if (!canAct(state, actor)) return false;
  const step = currentStepOf(state)!;
  return step.role === "HR" || step.approverId === actor.employeeId;
}

export function applyDecision(state: RequestState, actor: Actor, decision: Decision, comment?: string): Outcome {
  if (state.status !== "PENDING") return { ok: false, error: "This request is no longer pending." };
  if (!canAct(state, actor)) return { ok: false, error: "You can't act on this request." };
  if (decision === "DECLINED" && !comment?.trim()) return { ok: false, error: "Add a short reason when declining." };

  const steps = state.steps.map((s) => (s.order === state.currentStep ? { ...s, decision, decidedById: actor.employeeId } : s));
  if (decision === "DECLINED") return { ok: true, state: { ...state, steps, status: "DECLINED" } };

  const lastOrder = Math.max(...state.steps.map((s) => s.order));
  const isLast = state.currentStep === lastOrder;
  return {
    ok: true,
    state: { ...state, steps, status: isLast ? "APPROVED" : "PENDING", currentStep: isLast ? state.currentStep : state.currentStep + 1 },
  };
}

export function applyWithdraw(state: RequestState, actorEmployeeId: string): Outcome {
  if (state.status !== "PENDING") return { ok: false, error: "Only pending requests can be withdrawn." };
  if (actorEmployeeId !== state.requesterId) return { ok: false, error: "Only the person who asked can withdraw this request." };
  return { ok: true, state: { ...state, status: "WITHDRAWN" } };
}
