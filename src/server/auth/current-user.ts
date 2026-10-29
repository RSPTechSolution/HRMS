import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/domain/auth/types";
import { validateSessionToken } from "./sessions";
import { readSessionCookie } from "./session-cookie";

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionCookie();
  if (!token) return null;
  return (await validateSessionToken(token))?.user ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
