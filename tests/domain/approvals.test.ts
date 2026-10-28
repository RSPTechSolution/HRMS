import { describe, expect, it } from "vitest";
import { parsePolicySteps, planSteps } from "@/domain/approvals/routing";
import { applyDecision, applyWithdraw, canAct } from "@/domain/approvals/decide";
import type { Actor, RequestState } from "@/domain/approvals/types";

const requester = { employeeId: "emp", managerId: "mgr" };

describe("parsePolicySteps", () => {
  it("parses a valid policy", () => {
    expect(parsePolicySteps('["MANAGER","HR"]')).toEqual(["MANAGER", "HR"]);
  });
  it.each(["[]", '["CEO"]', '{"a":1}', "nope"])("rejects %s", (json) => {
    expect(() => parsePolicySteps(json)).toThrow();
  });
});

describe("planSteps", () => {
  it("routes to the manager, then HR", () => {
    expect(planSteps(["MANAGER", "HR"], requester)).toEqual([
      { order: 0, role: "MANAGER", approverId: "mgr" },
      { order: 1, role: "HR", approverId: null },
    ]);
  });
  it("skips the manager step when there is no manager", () => {
    expect(planSteps(["MANAGER", "HR"], { employeeId: "emp", managerId: null })).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
  it("never routes a request to the requester", () => {
    expect(planSteps(["MANAGER"], { employeeId: "emp", managerId: "emp" })).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
  it("falls back to HR when a manager-only policy has no manager", () => {
    expect(planSteps(["MANAGER"], { employeeId: "emp", managerId: null })).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
  it("does not duplicate HR steps", () => {
    expect(planSteps(["HR", "HR"], requester)).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
});

const twoStep = (): RequestState => ({
  status: "PENDING",
  currentStep: 0,
  requesterId: "emp",
  steps: [
    { order: 0, role: "MANAGER", approverId: "mgr", decision: null, decidedById: null },
    { order: 1, role: "HR", approverId: null, decision: null, decidedById: null },
  ],
});
const manager: Actor = { employeeId: "mgr", isHR: false, isAdmin: false };
const hr: Actor = { employeeId: "hr1", isHR: true, isAdmin: false };
const other: Actor = { employeeId: "x", isHR: false, isAdmin: false };

describe("canAct", () => {
  it("lets the named manager act on the manager step", () => {
    expect(canAct(twoStep(), manager)).toBe(true);
    expect(canAct(twoStep(), other)).toBe(false);
  });
  it("lets HR override the manager step", () => {
    expect(canAct(twoStep(), hr)).toBe(true);
  });
  it("never lets requesters act on their own request, even as HR", () => {
    expect(canAct(twoStep(), { employeeId: "emp", isHR: true, isAdmin: true })).toBe(false);
  });
  it("stops someone who decided an earlier step from deciding the next", () => {
    const afterHrOverride = applyDecision(twoStep(), hr, "APPROVED");
    if (!afterHrOverride.ok) throw new Error(afterHrOverride.error);
    expect(canAct(afterHrOverride.state, hr)).toBe(false);
    expect(canAct(afterHrOverride.state, { employeeId: "hr2", isHR: true, isAdmin: false })).toBe(true);
  });
});

describe("applyDecision", () => {
  it("moves through steps and approves after the last one", () => {
    const first = applyDecision(twoStep(), manager, "APPROVED");
    if (!first.ok) throw new Error(first.error);
    expect(first.state).toMatchObject({ status: "PENDING", currentStep: 1 });
    expect(first.state.steps[0]).toMatchObject({ decision: "APPROVED", decidedById: "mgr" });
    expect(canAct(first.state, manager)).toBe(false);

    const second = applyDecision(first.state, hr, "APPROVED");
    if (!second.ok) throw new Error(second.error);
    expect(second.state).toMatchObject({ status: "APPROVED", currentStep: 1 });
  });

  it("requires a reason to decline, then ends the request", () => {
    expect(applyDecision(twoStep(), manager, "DECLINED", "  ")).toEqual({ ok: false, error: "Add a short reason when declining." });
    const declined = applyDecision(twoStep(), manager, "DECLINED", "Release week");
    if (!declined.ok) throw new Error(declined.error);
    expect(declined.state.status).toBe("DECLINED");
  });

  it("rejects people who can't act and requests that are closed", () => {
    expect(applyDecision(twoStep(), other, "APPROVED")).toEqual({ ok: false, error: "You can't act on this request." });
    expect(applyDecision({ ...twoStep(), status: "WITHDRAWN" }, manager, "APPROVED")).toEqual({ ok: false, error: "This request is no longer pending." });
  });
});

describe("applyWithdraw", () => {
  it("lets only the requester withdraw a pending request", () => {
    expect(applyWithdraw(twoStep(), "mgr")).toEqual({ ok: false, error: "Only the person who asked can withdraw this request." });
    const done = applyWithdraw(twoStep(), "emp");
    expect(done.ok && done.state.status).toBe("WITHDRAWN");
    expect(applyWithdraw({ ...twoStep(), status: "APPROVED" }, "emp")).toEqual({ ok: false, error: "Only pending requests can be withdrawn." });
  });
});
