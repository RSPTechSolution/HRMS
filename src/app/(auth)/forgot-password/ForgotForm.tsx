"use client";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { forgotPasswordAction } from "../actions";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="auth-card rv" noValidate>
      <h1 className="h1">Reset your password</h1>
      <p className="lede">We&apos;ll email you a link to choose a new one.</p>
      <label className="label" htmlFor="email">Work email</label>
      <input className="field" id="email" name="email" type="email" autoComplete="username" defaultValue={state?.email} required autoFocus />
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.message ? <p className="form-msg">{state.message}</p> : null}
      <SubmitButton>Send reset link</SubmitButton>
      <p className="after"><Link className="link" href="/login">Back to sign in</Link></p>
    </form>
  );
}
