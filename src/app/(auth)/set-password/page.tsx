import Link from "next/link";
import type { Metadata } from "next";
import { peekPasswordToken } from "@/server/auth/password-tokens";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Set your password" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const info = typeof token === "string" ? await peekPasswordToken(token) : null;
  if (typeof token !== "string" || !info) {
    return (
      <div className="auth-card rv">
        <h1 className="h1">This link has expired</h1>
        <p className="lede">Links work once and only for a limited time. Ask for a fresh one and you&apos;ll be back in a minute.</p>
        <Link className="btn btn-primary" href="/forgot-password">Get a new link</Link>
      </div>
    );
  }
  return <SetPasswordForm token={token} purpose={info.purpose} email={info.email} />;
}
