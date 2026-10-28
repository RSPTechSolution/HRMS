import "server-only";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { generateToken, sha256 } from "@/lib/crypto";
import { validateNewPassword } from "@/domain/auth/password-policy";
import { sendMail } from "@/server/mail/mailer";
import { hashPassword } from "./password";

const TTL_MS = { SET: 72 * 3_600_000, RESET: 3_600_000 } as const;
export type TokenPurpose = keyof typeof TTL_MS;

const EXPIRED = "This link has expired or was already used. Ask for a new one.";

export async function issuePasswordToken(userId: string, purpose: TokenPurpose, now = new Date()): Promise<string> {
  const token = generateToken();
  await db.$transaction([
    db.passwordToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
    db.passwordToken.create({
      data: { id: sha256(token), userId, purpose, expiresAt: new Date(now.getTime() + TTL_MS[purpose]) },
    }),
  ]);
  return token;
}

export async function sendSetPasswordEmail(userId: string, now = new Date()): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { employee: true } });
  const token = await issuePasswordToken(userId, "SET", now);
  const firstName = user.employee.fullName.split(" ")[0];
  await sendMail({
    to: user.email,
    subject: "Welcome to LN People — set your password",
    text: `Hi ${firstName},\n\nYour LN People account is ready. Set your password here (the link works for 72 hours):\n${APP_URL}/set-password?token=${token}\n`,
  });
}

export async function requestPasswordReset(emailInput: string, now = new Date()): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, include: { employee: true } });
  if (!user || user.employee.status === "EXITED") return;
  const token = await issuePasswordToken(user.id, "RESET", now);
  await sendMail({
    to: user.email,
    subject: "Reset your LN People password",
    text: `Someone asked to reset your LN People password. If it was you, use this link within 1 hour:\n${APP_URL}/set-password?token=${token}\n\nIf it wasn't you, you can ignore this email.`,
  });
}

export async function peekPasswordToken(token: string, now = new Date()): Promise<{ purpose: TokenPurpose; email: string } | null> {
  const row = await db.passwordToken.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) return null;
  return { purpose: row.purpose as TokenPurpose, email: row.user.email };
}

export async function consumePasswordToken(
  token: string,
  newPassword: string,
  now = new Date(),
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const row = await db.passwordToken.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) return { ok: false, error: EXPIRED };
  const policyError = validateNewPassword(newPassword, row.user.email);
  if (policyError) return { ok: false, error: policyError };

  const passwordHash = await hashPassword(newPassword);
  const used = await db.$transaction(async (tx) => {
    const claim = await tx.passwordToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claim.count !== 1) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return true;
  });
  return used ? { ok: true, userId: row.userId } : { ok: false, error: EXPIRED };
}
