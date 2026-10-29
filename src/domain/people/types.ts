export const EMPLOYMENT_TYPES = ["FULL_TIME", "INTERN", "CONTRACT"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYEE_STATUSES = ["ACTIVE", "NOTICE", "EXITED"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const GENDERS = ["FEMALE", "MALE", "OTHER", "PREFER_NOT"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = { FULL_TIME: "Full-time", INTERN: "Intern", CONTRACT: "Contract" };
export const STATUS_LABELS: Record<EmployeeStatus, string> = { ACTIVE: "Active", NOTICE: "On notice", EXITED: "Exited" };
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = { FEMALE: "Female", MALE: "Male", OTHER: "Other", PREFER_NOT: "Prefer not to say" };
