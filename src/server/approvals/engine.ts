import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/domain/auth/types";
import { applyDecision, applyWithdraw, isWaitingOn } from "@/domain/approvals/decide";
import { parsePolicySteps, planSteps } from "@/domain/approvals/routing";
import type { Actor, Decision, RequestState, RequestStatus, StepRole } from "@/domain/approvals/types";
import { writeAudit } from "@/server/audit";
import { notifyEmployees } from "@/server/notifications";
import type { Db, DbTx } from "@/server/db-types";
import { getApprovalHooks, type ApprovalRef } from "./registry";

type RequestWithSteps = Prisma.ApprovalRequestGetPayload<{ include: { steps: true } }>;
type EngineResult = { ok: true; status: RequestStatus } | { ok: false; error: string };

const actorOf = (u: CurrentUser): Actor => ({ employeeId: u.employeeId, isHR: u.isHR, isAdmin: u.isAdmin });

function toState(r: RequestWithSteps): RequestState {
  return {
    status: r.status as RequestStatus,
    currentStep: r.currentStep,
    requesterId: r.requesterId,
    steps: [...r.steps]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        order: s.order,
        role: s.role as StepRole,
        approverId: s.approverId,
        decision: s.decision as Decision | null,
        decidedById: s.decidedById,
      })),
  };
}

const refOf = (r: RequestWithSteps): ApprovalRef => ({ id: r.id, type: r.type, subjectId: r.subjectId, requesterId: r.requesterId, summary: r.summary });

async function notifyNextApprovers(tx: Db, r: RequestWithSteps): Promise<void> {
  const step = r.steps.find((s) => s.order === r.currentStep);
  if (!step) return;
  const requester = await tx.employee.findUniqueOrThrow({ where: { id: r.requesterId }, select: { fullName: true } });
  let employeeIds: string[];
  if (step.role === "MANAGER" && step.approverId) {
    employeeIds = [step.approverId];
  } else {
    const hrUsers = await tx.user.findMany({
      where: { OR: [{ isHR: true }, { isAdmin: true }], employeeId: { not: r.requesterId }, employee: { status: { not: "EXITED" } } },
      select: { employeeId: true },
    });
    const alreadyDecided = new Set(r.steps.map((s) => s.decidedById).filter(Boolean));
    employeeIds = hrUsers.map((u) => u.employeeId).filter((id) => !alreadyDecided.has(id));
  }
  const label = getApprovalHooks(r.type).label;
  await notifyEmployees(tx, employeeIds, { kind: "approval.pending", title: `${requester.fullName} needs your approval · ${label}: ${r.summary}`, link: "/approvals" });
}

export async function submitApproval(tx: Db, input: { type: string; subjectId: string; requesterId: string; summary: string }): Promise<RequestWithSteps> {
  const policy = await tx.approvalPolicy.findUnique({ where: { type: input.type } });
  if (!policy) throw new Error(`No approval policy configured for "${input.type}"`);
  const requester = await tx.employee.findUniqueOrThrow({
    where: { id: input.requesterId },
    select: { id: true, manager: { select: { id: true, status: true } } },
  });
  const activeManagerId = requester.manager && requester.manager.status !== "EXITED" ? requester.manager.id : null;
  const steps = planSteps(parsePolicySteps(policy.steps), { employeeId: requester.id, managerId: activeManagerId });
  const created = await tx.approvalRequest.create({
    data: {
      type: input.type,
      subjectId: input.subjectId,
      requesterId: input.requesterId,
      summary: input.summary,
      steps: { create: steps.map((s) => ({ order: s.order, role: s.role, approverId: s.approverId })) },
    },
    include: { steps: true },
  });
  await notifyNextApprovers(tx, created);
  return created;
}

async function finish(tx: DbTx, r: RequestWithSteps, status: RequestStatus, comment: string | undefined): Promise<void> {
  const hooks = getApprovalHooks(r.type);
  const ref = refOf(r);
  const link = hooks.link?.(ref) ?? "/home";
  if (status === "APPROVED") {
    await hooks.onApproved?.(tx, ref);
    await notifyEmployees(tx, [r.requesterId], { kind: "approval.approved", title: `Approved · ${hooks.label}: ${r.summary}`, link });
  } else if (status === "DECLINED") {
    await hooks.onClosed?.(tx, ref, "DECLINED");
    await notifyEmployees(tx, [r.requesterId], { kind: "approval.declined", title: `Declined · ${hooks.label}: ${r.summary} — "${comment?.trim()}"`, link });
  } else if (status === "WITHDRAWN") {
    await hooks.onClosed?.(tx, ref, "WITHDRAWN");
  }
}

export function decideApproval(actor: CurrentUser, requestId: string, decision: Decision, comment?: string, now = new Date()): Promise<EngineResult> {
  return db.$transaction(async (tx): Promise<EngineResult> => {
    const r = await tx.approvalRequest.findUnique({ where: { id: requestId }, include: { steps: true } });
    if (!r) return { ok: false, error: "Request not found." };
    const state = toState(r);
    const outcome = applyDecision(state, actorOf(actor), decision, comment);
    if (!outcome.ok) return outcome;

    const claim = await tx.approvalRequest.updateMany({
      where: { id: r.id, status: "PENDING", currentStep: state.currentStep },
      data: { status: outcome.state.status, currentStep: outcome.state.currentStep },
    });
    if (claim.count !== 1) return { ok: false, error: "Someone else already acted on this request." };

    const step = r.steps.find((s) => s.order === state.currentStep)!;
    await tx.approvalStep.update({
      where: { id: step.id },
      data: { decision, decidedById: actor.employeeId, comment: comment?.trim() || null, decidedAt: now },
    });
    await writeAudit(tx, {
      actorId: actor.userId,
      action: `approval.${decision.toLowerCase()}`,
      entityType: "ApprovalRequest",
      entityId: r.id,
      before: { status: state.status, currentStep: state.currentStep },
      after: { status: outcome.state.status, currentStep: outcome.state.currentStep },
    });

    const updated = await tx.approvalRequest.findUniqueOrThrow({ where: { id: r.id }, include: { steps: true } });
    if (outcome.state.status === "PENDING") await notifyNextApprovers(tx, updated);
    else await finish(tx, updated, outcome.state.status, comment);
    return { ok: true, status: outcome.state.status };
  });
}

export function withdrawApproval(actor: CurrentUser, requestId: string, now = new Date()): Promise<EngineResult> {
  return db.$transaction(async (tx): Promise<EngineResult> => {
    const r = await tx.approvalRequest.findUnique({ where: { id: requestId }, include: { steps: true } });
    if (!r) return { ok: false, error: "Request not found." };
    const outcome = applyWithdraw(toState(r), actor.employeeId);
    if (!outcome.ok) return outcome;
    const claim = await tx.approvalRequest.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "WITHDRAWN", updatedAt: now } });
    if (claim.count !== 1) return { ok: false, error: "Someone else already acted on this request." };
    await writeAudit(tx, { actorId: actor.userId, action: "approval.withdrawn", entityType: "ApprovalRequest", entityId: r.id, before: { status: "PENDING" }, after: { status: "WITHDRAWN" } });
    await finish(tx, r, "WITHDRAWN", undefined);
    return { ok: true, status: "WITHDRAWN" };
  });
}

/** The requester's own requests, newest first. */
export function listMyRequests(actor: CurrentUser, take = 50): Promise<RequestWithSteps[]> {
  return db.approvalRequest.findMany({ where: { requesterId: actor.employeeId }, include: { steps: true }, orderBy: { createdAt: "desc" }, take });
}

/** Full names for everyone a set of requests mentions (requesters, approvers, deciders). */
export async function namesFor(rows: RequestWithSteps[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.requesterId);
    for (const s of r.steps) {
      if (s.approverId) ids.add(s.approverId);
      if (s.decidedById) ids.add(s.decidedById);
    }
  }
  const people = await db.employee.findMany({ where: { id: { in: [...ids] } }, select: { id: true, fullName: true } });
  return new Map(people.map((p) => [p.id, p.fullName]));
}

/** Where a request stands, in words: "Waiting on Ananya Sharma", "Waiting on HR", "Declined by …". */
export function describeStep(r: RequestWithSteps, names: Map<string, string>): string {
  if (r.status === "APPROVED") return "Approved";
  if (r.status === "WITHDRAWN") return "Withdrawn";
  if (r.status === "DECLINED") {
    const decider = r.steps.find((s) => s.decision === "DECLINED")?.decidedById;
    return `Declined by ${(decider && names.get(decider)) || "an approver"}`;
  }
  const step = r.steps.find((s) => s.order === r.currentStep);
  if (step?.role === "MANAGER" && step.approverId) return `Waiting on ${names.get(step.approverId) ?? "their manager"}`;
  return "Waiting on HR";
}

export async function listPendingFor(actor: CurrentUser): Promise<RequestWithSteps[]> {
  const rows = await db.approvalRequest.findMany({
    where: { status: "PENDING", requesterId: { not: actor.employeeId } },
    include: { steps: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((r) => isWaitingOn(toState(r), actorOf(actor)));
}
