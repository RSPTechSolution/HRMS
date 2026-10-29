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

  // Reserve this attempt as a failure *before* checking the lock, so parallel guesses see each other.
  const attempt = await db.loginAttempt.create({ data: { email, success: false, at: now } });
  const others = await db.loginAttempt.findMany({
    where: { email, id: { not: attempt.id } },
    orderBy: { at: "desc" },
    take: 50,
  });
  if (isLockedOut(others, now)) {
    await db.loginAttempt.delete({ where: { id: attempt.id } });
    return { ok: false, reason: "locked" };
  }

  const user = await db.user.findUnique({ where: { email }, include: { employee: true } });
  let passwordOk = false;
  if (user?.passwordHash) passwordOk = await verifyPassword(user.passwordHash, password);
  else await verifyPassword(await getDummyHash(), password);

  const ok = !!user && passwordOk && user.employee.status !== "EXITED";
  if (ok) await db.loginAttempt.update({ where: { id: attempt.id }, data: { success: true } });
  return ok && user ? { ok: true, userId: user.id } : { ok: false, reason: "invalid" };
}
