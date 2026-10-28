import "server-only";
import { db } from "@/lib/db";
import { isLockedOut } from "@/domain/auth/lockout";
import { hashPassword, verifyPassword } from "./password";

export type AuthResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" };

let dummyHash: Promise<string> | null = null;
/** Verifying against a dummy hash keeps response time similar whether or not the email exists. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("dummy-password-for-timing-only");
  return dummyHash;
}

export async function authenticate(emailInput: string, password: string, now = new Date()): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase();
  const attempts = await db.loginAttempt.findMany({ where: { email }, orderBy: { at: "desc" }, take: 20 });
  if (isLockedOut(attempts, now)) return { ok: false, reason: "locked" };

  const user = await db.user.findUnique({ where: { email }, include: { employee: true } });
  let passwordOk = false;
  if (user?.passwordHash) passwordOk = await verifyPassword(user.passwordHash, password);
  else await verifyPassword(await getDummyHash(), password);

  const ok = !!user && passwordOk && user.employee.status !== "EXITED";
  await db.loginAttempt.create({ data: { email, success: ok, at: now } });
  return ok && user ? { ok: true, userId: user.id } : { ok: false, reason: "invalid" };
}
