import { z } from "zod";
import { isRealDate } from "@/lib/dates";
import { BLOOD_GROUPS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, GENDERS } from "./types";

const blankToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blankToNull, schema.nullable());
/** HTML checkboxes send "on"; JSON callers send booleans. */
const flag = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

const isoDate = z.string().refine(isRealDate, "Use a real date like 2026-10-29.");
const phone = z.string().trim().regex(/^\+?\d{10,15}$/, "Enter a phone number with 10 to 15 digits.");
const lowerEmail = (message: string) => z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email(message));

const contactFields = {
  phone: opt(phone),
  personalEmail: opt(lowerEmail("Enter a valid email address.")),
  currentAddress: opt(z.string().trim().max(300)),
  permanentAddress: opt(z.string().trim().max(300)),
  emergencyName: opt(z.string().trim().max(80)),
  emergencyRelation: opt(z.string().trim().max(40)),
  emergencyPhone: opt(phone),
};

/** HR create/edit form. `today` (YYYY-MM-DD, IST) keeps the age check pure. */
export function makeEmployeeInputSchema(today: string) {
  const sixteenYearsAgo = `${Number(today.slice(0, 4)) - 16}${today.slice(4)}`;
  return z.object({
    fullName: z.string().trim().min(2, "Enter the full name.").max(80),
    workEmail: lowerEmail("Enter a valid work email."),
    designationId: z.string().min(1, "Pick a designation."),
    departmentId: z.string().min(1, "Pick a department."),
    managerId: opt(z.string()),
    joinedOn: isoDate,
    probationEndsOn: opt(isoDate),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    status: z.enum(EMPLOYEE_STATUSES),
    location: z.string().trim().min(1, "Enter a location.").max(60),
    dateOfBirth: opt(isoDate.refine((d) => d <= sixteenYearsAgo, "Employees must be at least 16 years old.")),
    gender: opt(z.enum(GENDERS)),
    bloodGroup: opt(z.enum(BLOOD_GROUPS)),
    ...contactFields,
    bankHolder: opt(z.string().trim().max(80)),
    bankAccount: opt(z.string().trim().regex(/^\d{9,18}$/, "Bank account numbers have 9 to 18 digits.")),
    bankIfsc: opt(z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks like SBIN0001234.")),
    pan: opt(z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCDE1234F.")),
    aadhaar: opt(z.string().trim().regex(/^\d{12}$/, "Aadhaar has 12 digits.")),
    isHR: flag,
    isPayroll: flag,
    isAdmin: flag,
  });
}

export type EmployeeInput = z.infer<ReturnType<typeof makeEmployeeInputSchema>>;

/** The only fields employees may change about themselves. Unknown keys are dropped. */
export const selfEditSchema = z.object({ ...contactFields, showBirthday: flag });
export type SelfEditInput = z.infer<typeof selfEditSchema>;
