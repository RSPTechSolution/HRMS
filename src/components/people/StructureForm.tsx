"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { errorProps, FormError } from "@/components/ui/FormFeedback";
import { saveStructureAction } from "@/app/(app)/people/actions";

/** One inline add/rename form for a department or designation. */
export function StructureForm({ kind, id, name, level, count }: { kind: "department" | "designation"; id?: string; name?: string; level?: number; count?: number }) {
  const [state, action] = useActionState(saveStructureAction, undefined);
  const errId = `err-${kind}-${id ?? "new"}`;
  return (
    <form action={action} className="row" style={{ flexWrap: "wrap" }}>
      <input type="hidden" name="kind" value={kind} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <label className="sr" htmlFor={`${errId}-name`}>{kind === "department" ? "Department name" : "Designation title"}</label>
      <input id={`${errId}-name`} name="name" className="field" style={{ flex: "1 1 200px" }} defaultValue={name ?? ""} placeholder={id ? undefined : kind === "department" ? "New department" : "New designation"} required {...errorProps(errId, state?.error)} />
      {kind === "designation" ? (
        <>
          <label className="sr" htmlFor={`${errId}-level`}>Level</label>
          <input id={`${errId}-level`} name="level" type="number" min={1} max={10} className="field" style={{ width: 90 }} defaultValue={level ?? 1} aria-label="Level" />
        </>
      ) : null}
      {count !== undefined ? <span className="tag">{count} people</span> : null}
      <SubmitButton className="btn btn-ghost" label={id ? `Save ${name}` : `Add ${kind}`}>{id ? "Save" : "Add"}</SubmitButton>
      {state?.error ? <FormError id={errId}>{state.error}</FormError> : null}
    </form>
  );
}
