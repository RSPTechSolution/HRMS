"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormFeedback";
import { createEmployeeAction, updateEmployeeAction, updateMyDetailsAction, type PeopleFormState } from "@/app/(app)/people/actions";
import { BLOOD_GROUPS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES, GENDER_LABELS, GENDERS, STATUS_LABELS } from "@/domain/people/types";

type Option = { id: string; label: string };
type Values = Record<string, string | boolean | null | undefined>;

function Field({ name, label, state, type = "text", value, required, readOnly, full, children }: {
  name: string; label: string; state: PeopleFormState; type?: string; value?: string | null; required?: boolean; readOnly?: boolean; full?: boolean; children?: React.ReactNode;
}) {
  const invalid = state?.field === name;
  const common = { id: `f-${name}`, name, className: "field", required, "aria-invalid": invalid || undefined, "aria-describedby": invalid ? "employee-form-error" : undefined };
  return (
    <div className={full ? "full" : undefined}>
      <label className="label" htmlFor={`f-${name}`}>{label}{required ? null : <span className="muted"> (optional)</span>}</label>
      {children ? (
        <select {...common} defaultValue={value ?? ""}>{children}</select>
      ) : (
        <input {...common} type={type} defaultValue={value ?? ""} readOnly={readOnly} aria-readonly={readOnly || undefined} />
      )}
    </div>
  );
}

const str = (v: Values[string]) => (typeof v === "string" ? v : null);

export function EmployeeForm({ mode, employeeId, initial, designations, departments, managers, canAssignRoles, canEditEmail }: {
  mode: "create" | "edit";
  employeeId?: string;
  initial: Values;
  designations: Option[];
  departments: Option[];
  managers: Option[];
  canAssignRoles: boolean;
  canEditEmail: boolean;
}) {
  const action = mode === "create" ? createEmployeeAction : updateEmployeeAction.bind(null, employeeId!);
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="card" noValidate>
      {state?.error ? <FormError id="employee-form-error">{state.error}</FormError> : null}
      <fieldset className="group">
        <legend>Job</legend>
        <div className="form-grid">
          <Field name="fullName" label="Full name" state={state} value={str(initial.fullName)} required />
          <Field name="workEmail" label="Work email (their login)" type="email" state={state} value={str(initial.workEmail)} required readOnly={!canEditEmail} />
          <Field name="designationId" label="Designation" state={state} value={str(initial.designationId)} required>
            <option value="">Choose…</option>
            {designations.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Field>
          <Field name="departmentId" label="Department" state={state} value={str(initial.departmentId)} required>
            <option value="">Choose…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Field>
          <Field name="managerId" label="Reports to" state={state} value={str(initial.managerId)}>
            <option value="">Nobody</option>
            {managers.filter((m) => m.id !== employeeId).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Field>
          <Field name="location" label="Location" state={state} value={str(initial.location) ?? "Mohali"} required />
          <Field name="joinedOn" label="Joining date" type="date" state={state} value={str(initial.joinedOn)} required />
          <Field name="probationEndsOn" label="Probation ends" type="date" state={state} value={str(initial.probationEndsOn)} />
          <Field name="employmentType" label="Employment type" state={state} value={str(initial.employmentType) ?? "FULL_TIME"} required>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
          </Field>
          <Field name="status" label="Status" state={state} value={str(initial.status) ?? "ACTIVE"} required>
            {EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Field>
        </div>
      </fieldset>
      <fieldset className="group">
        <legend>Personal</legend>
        <div className="form-grid">
          <Field name="dateOfBirth" label="Date of birth" type="date" state={state} value={str(initial.dateOfBirth)} />
          <Field name="gender" label="Gender" state={state} value={str(initial.gender)}>
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
          </Field>
          <Field name="bloodGroup" label="Blood group" state={state} value={str(initial.bloodGroup)}>
            <option value="">—</option>
            {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Field>
          <Field name="phone" label="Phone" type="tel" state={state} value={str(initial.phone)} />
          <Field name="personalEmail" label="Personal email" type="email" state={state} value={str(initial.personalEmail)} />
          <Field name="currentAddress" label="Current address" state={state} value={str(initial.currentAddress)} full />
          <Field name="permanentAddress" label="Permanent address" state={state} value={str(initial.permanentAddress)} full />
          <Field name="emergencyName" label="Emergency contact" state={state} value={str(initial.emergencyName)} />
          <Field name="emergencyRelation" label="Relation" state={state} value={str(initial.emergencyRelation)} />
          <Field name="emergencyPhone" label="Emergency phone" type="tel" state={state} value={str(initial.emergencyPhone)} />
        </div>
      </fieldset>
      <fieldset className="group">
        <legend>Bank and IDs</legend>
        <div className="form-grid">
          <Field name="bankHolder" label="Account holder" state={state} value={str(initial.bankHolder)} />
          <Field name="bankAccount" label="Account number" state={state} value={str(initial.bankAccount)} />
          <Field name="bankIfsc" label="IFSC" state={state} value={str(initial.bankIfsc)} />
          <Field name="pan" label="PAN" state={state} value={str(initial.pan)} />
          <Field name="aadhaar" label="Aadhaar" state={state} value={str(initial.aadhaar)} />
        </div>
      </fieldset>
      {canAssignRoles ? (
        <fieldset className="group">
          <legend>Access</legend>
          <div className="checks">
            <label><input type="checkbox" name="isHR" defaultChecked={initial.isHR === true} /> HR</label>
            <label><input type="checkbox" name="isPayroll" defaultChecked={initial.isPayroll === true} /> Payroll</label>
            <label><input type="checkbox" name="isAdmin" defaultChecked={initial.isAdmin === true} /> Admin</label>
          </div>
        </fieldset>
      ) : null}
      <div className="actions-row">
        <SubmitButton>{mode === "create" ? "Add employee and send invite" : "Save changes"}</SubmitButton>
      </div>
    </form>
  );
}

/** What employees may change about themselves. */
export function SelfEditForm({ initial }: { initial: Values }) {
  const [state, formAction] = useActionState(updateMyDetailsAction, undefined);
  return (
    <form action={formAction} className="card" noValidate>
      {state?.error ? <FormError id="employee-form-error">{state.error}</FormError> : null}
      <div className="form-grid">
        <Field name="phone" label="Phone" type="tel" state={state} value={str(initial.phone)} />
        <Field name="personalEmail" label="Personal email" type="email" state={state} value={str(initial.personalEmail)} />
        <Field name="currentAddress" label="Current address" state={state} value={str(initial.currentAddress)} full />
        <Field name="permanentAddress" label="Permanent address" state={state} value={str(initial.permanentAddress)} full />
        <Field name="emergencyName" label="Emergency contact" state={state} value={str(initial.emergencyName)} />
        <Field name="emergencyRelation" label="Relation" state={state} value={str(initial.emergencyRelation)} />
        <Field name="emergencyPhone" label="Emergency phone" type="tel" state={state} value={str(initial.emergencyPhone)} />
      </div>
      <div className="checks">
        <label><input type="checkbox" name="showBirthday" defaultChecked={initial.showBirthday !== false} /> Show my birthday to colleagues</label>
      </div>
      <div className="actions-row"><SubmitButton>Save my details</SubmitButton></div>
    </form>
  );
}
