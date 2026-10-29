"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { authenticate } from "@/server/auth/login";
import { createSession, revokeAllSessions, revokeSession } from "@/server/auth/sessions";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "@/server/auth/session-cookie";
import { consumePasswordToken, requestPasswordReset } from "@/server/auth/password-tokens";
import { requireUser } from "@/server/auth/current-user";

export type FormState = { error?: string; message?: string; email?: string } | undefined;

const loginSchema = z.object({ email: z.email(), password: z.string().min(1), next: z.string().optional() });

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email: email.trim(), password: formData.get("password"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { error: "Enter your work email and password.", email };
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      error: result.reason === "locked" ? "Too many attempts. Try again in 15 minutes." : "That email and password don't match.",
      email,
    };
  }
  const { token, expiresAt } = await createSession(result.userId);
  await setSessionCookie(token, expiresAt);
  redirect(safeNext(parsed.data.next));
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email address.", email };
  await requestPasswordReset(email);
  return { message: "If that email belongs to an LN People account, a reset link is on its way. It works for 1 hour." };
}

export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const result = await consumePasswordToken(token, password);
  if (!result.ok) return { error: result.error };
  const { token: sessionToken, expiresAt } = await createSession(result.userId);
  await setSessionCookie(sessionToken, expiresAt);
  redirect("/home");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionCookie();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function logoutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await revokeAllSessions(user.userId);
  await clearSessionCookie();
  redirect("/login");
}
