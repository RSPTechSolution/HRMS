import { describe, expect, it } from "vitest";
import { makeEmployeeInputSchema, selfEditSchema } from "@/domain/people/schemas";
import { maskTail, profileAccess } from "@/domain/people/access";
import { buildOrgTree, isInChain, reportsOf, wouldCreateCycle } from "@/domain/people/hierarchy";
import type { CurrentUser } from "@/domain/auth/types";

const TODAY = "2026-10-29";
const schema = makeEmployeeInputSchema(TODAY);
const valid = {
  fullName: "Test Person",
  workEmail: "Test.Person@LNWebworks.test",
  designationId: "d1",
  departmentId: "dep1",
  managerId: "",
  joinedOn: "2026-10-01",
  probationEndsOn: "",
  employmentType: "FULL_TIME",
  status: "ACTIVE",
  location: "Mohali",
  phone: "+919876543210",
  personalEmail: "",
  dateOfBirth: "1995-04-12",
  gender: "",
  bloodGroup: "O+",
  currentAddress: "",
  permanentAddress: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyPhone: "",
  bankHolder: "Test Person",
  bankAccount: "123456789012",
  bankIfsc: "SBIN0001234",
  pan: "ABCDE1234F",
  aadhaar: "123412341234",
  isHR: "",
  isPayroll: "on",
  isAdmin: false,
};

describe("employee input", () => {
  it("accepts a full record, lowercases the email and turns blanks into null", () => {
    const r = schema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.workEmail).toBe("test.person@lnwebworks.test");
    expect(r.data.managerId).toBeNull();
    expect(r.data.personalEmail).toBeNull();
    expect(r.data.isPayroll).toBe(true);
    expect(r.data.isHR).toBe(false);
  });
  it.each([
    ["pan", "abcde1234f"],
    ["bankIfsc", "SBIN1234567"],
    ["aadhaar", "12341234123"],
    ["dateOfBirth", "2027-01-01"],
    ["dateOfBirth", "2015-01-01"],
    ["bloodGroup", "C+"],
    ["phone", "12ab"],
  ])("rejects %s = %s", (field, value) => {
    const r = schema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe(field);
  });
  it("self edit only keeps the allowed fields", () => {
    const r = selfEditSchema.safeParse({ phone: "9876543210", fullName: "Hacker", showBirthday: "", pan: "ABCDE1234F" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).not.toHaveProperty("fullName");
    expect(r.data).not.toHaveProperty("pan");
    expect(r.data.showBirthday).toBe(false);
  });
});

describe("maskTail", () => {
  it("keeps the last four characters", () => {
    expect(maskTail("123456789012")).toBe("•••• •••• 9012");
    expect(maskTail("ABCDE1234F")).toBe("•••• •• 234F");
    expect(maskTail("12")).toBe("12");
    expect(maskTail(null)).toBeNull();
  });
});

const user = (over: Partial<CurrentUser>): CurrentUser => ({
  userId: "u",
  employeeId: "viewer",
  email: "v@lnwebworks.test",
  fullName: "V",
  isHR: false,
  isPayroll: false,
  isAdmin: false,
  isManager: false,
  ...over,
});

describe("profileAccess", () => {
  it("self sees personal data with masked bank and ids, and edits own details", () => {
    expect(profileAccess(user({}), "viewer", false)).toEqual({
      level: "SELF", personal: true, bank: "MASKED", ids: "MASKED", attendance: true, documents: true, edit: "SELF", audit: false, roles: false,
    });
  });
  it("HR sees and edits everything but cannot assign roles; Admin can", () => {
    const hr = profileAccess(user({ isHR: true }), "other", false);
    expect(hr).toEqual({ level: "HR", personal: true, bank: "FULL", ids: "FULL", attendance: true, documents: true, edit: "FULL", audit: true, roles: false });
    expect(profileAccess(user({ isAdmin: true }), "other", false).roles).toBe(true);
    expect(profileAccess(user({ isHR: true }), "viewer", false).edit).toBe("FULL");
  });
  it("payroll sees bank and ids but not personal data", () => {
    expect(profileAccess(user({ isPayroll: true }), "other", false)).toEqual({
      level: "PAYROLL", personal: false, bank: "FULL", ids: "FULL", attendance: false, documents: false, edit: "NONE", audit: false, roles: false,
    });
  });
  it("managers see their reports' attendance only", () => {
    expect(profileAccess(user({ isManager: true }), "report", true)).toEqual({
      level: "MANAGER", personal: false, bank: "NONE", ids: "NONE", attendance: true, documents: false, edit: "NONE", audit: false, roles: false,
    });
  });
  it("colleagues see the public card only", () => {
    expect(profileAccess(user({}), "other", false)).toEqual({
      level: "COLLEAGUE", personal: false, bank: "NONE", ids: "NONE", attendance: false, documents: false, edit: "NONE", audit: false, roles: false,
    });
  });
});

describe("hierarchy", () => {
  const managerOf = new Map<string, string | null>([["A", null], ["B", "A"], ["C", "B"], ["D", null]]);
  it("follows direct and indirect reporting lines", () => {
    expect(isInChain("A", "C", managerOf)).toBe(true);
    expect(isInChain("C", "A", managerOf)).toBe(false);
    expect(isInChain("D", "C", managerOf)).toBe(false);
    const corrupt = new Map<string, string | null>([["X", "Y"], ["Y", "X"]]);
    expect(isInChain("Z", "X", corrupt)).toBe(false);
  });
  it("detects cycles before they are saved", () => {
    expect(wouldCreateCycle("A", "C", managerOf)).toBe(true);
    expect(wouldCreateCycle("A", "A", managerOf)).toBe(true);
    expect(wouldCreateCycle("A", null, managerOf)).toBe(false);
    expect(wouldCreateCycle("C", "D", managerOf)).toBe(false);
  });
  it("lists every level of reports and builds the org tree", () => {
    expect(reportsOf("A", managerOf).sort()).toEqual(["B", "C"]);
    expect(buildOrgTree(managerOf)).toEqual([
      { id: "A", children: [{ id: "B", children: [{ id: "C", children: [] }] }] },
      { id: "D", children: [] },
    ]);
  });
});
