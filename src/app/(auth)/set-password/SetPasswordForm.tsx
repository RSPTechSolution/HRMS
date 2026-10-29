"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { setPasswordAction } from "../actions";

export function SetPasswordForm({ token, purpose, email }: { token: string; purpose: "SET" | "RESET"; email: string }) {
  const [state, action] = useActionState(setPasswordAction, undefined);
  return (
    <form action={action} className="auth-card rv" noValidate>
      <h1 className="h1">{purpose === "SET" ? "Welcome to LN People" : "Choose a new password"}</h1>
      <p className="lede">For {email}. Use at least 10 characters.</p>
      <input type="hidden" name="token" value={token} />
      <label className="label" htmlFor="password">New password</label>
      <input className="field" id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
      <label className="label" htmlFor="confirm">Type it again</label>
      <input className="field" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <SubmitButton>Save and sign in</SubmitButton>
    </form>
  );
}
