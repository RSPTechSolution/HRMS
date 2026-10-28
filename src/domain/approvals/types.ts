export const STEP_ROLES = ["MANAGER", "HR"] as const;
export type StepRole = (typeof STEP_ROLES)[number];
export type RequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";
export type Decision = "APPROVED" | "DECLINED";

export type PlannedStep = { order: number; role: StepRole; approverId: string | null };
export type StepState = PlannedStep & { decision: Decision | null; decidedById: string | null };
export type RequestState = { status: RequestStatus; currentStep: number; requesterId: string; steps: StepState[] };
export type Actor = { employeeId: string; isHR: boolean; isAdmin: boolean };
export type Outcome = { ok: true; state: RequestState } | { ok: false; error: string };
