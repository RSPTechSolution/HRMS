"use client";
import { useActionState, useEffect } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toaster";
import type { SettingInputKind } from "@/domain/settings/settings";
import { updateSettingAction } from "@/app/(app)/settings/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingRow({ settingKey, label, help, kind, value }: { settingKey: string; label: string; help: string; kind: SettingInputKind; value: unknown }) {
  const [state, action] = useActionState(updateSettingAction, undefined);
  const toast = useToast();
  useEffect(() => {
    if (state?.savedAt) toast(`${label} saved`);
  }, [state?.savedAt, label, toast]);

  const id = `setting-${settingKey}`;
  return (
    <form action={action} className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
      <input type="hidden" name="key" value={settingKey} />
      <div style={{ flex: "1 1 260px" }}>
        <label className="t" htmlFor={id}>{label}</label>
        <p className="help">{help}</p>
        {state?.error ? <p className="form-error">{state.error}</p> : null}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 280px", justifyContent: "flex-end", flexWrap: "wrap" }}>
        {kind === "weekdays" ? (
          <fieldset id={id} style={{ border: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <legend className="sr">{label}</legend>
            {DAYS.map((d, i) => (
              <label key={d} className="pill" style={{ display: "inline-flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" name="value" value={i} defaultChecked={(value as number[]).includes(i)} /> {d}
              </label>
            ))}
          </fieldset>
        ) : (
          <input
            id={id}
            className="field"
            style={{ maxWidth: 220 }}
            name="value"
            type={kind === "text" || kind === "readonly" ? "text" : "number"}
            defaultValue={value === null ? "" : String(value)}
            readOnly={kind === "readonly"}
            aria-readonly={kind === "readonly"}
          />
        )}
        {kind === "readonly" ? null : <SubmitButton className="btn btn-ghost" label={`Save ${label}`}>Save</SubmitButton>}
      </div>
    </form>
  );
}
