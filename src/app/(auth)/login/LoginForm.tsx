"use client";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="auth-card rv" noValidate>
      <div className="eyebrow">LN People</div>
      <h1 className="h1">Welcome back</h1>
      <p className="lede">Sign in with your LN Webworks email.</p>
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="label" htmlFor="email">Work email</label>
      <input className="field" id="email" name="email" type="email" autoComplete="username" defaultValue={state?.email} required autoFocus />
      <label className="label" htmlFor="password">Password</label>
      <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <SubmitButton>Sign in</SubmitButton>
      <p className="after"><Link className="link" href="/forgot-password">Forgot your password?</Link></p>
    </form>
  );
}
