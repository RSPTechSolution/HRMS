import "server-only";
import { db } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";
import type { CurrentUser } from "@/domain/auth/types";
import { loadCurrentUser } from "./users";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

export type ValidSession = { sessionId: string; expiresAt: Date; user: CurrentUser };

export async function createSession(userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string, now = new Date()): Promise<ValidSession | null> {
  const id = sha256(token);
  const session = await db.session.findUnique({ where: { id } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  const user = await loadCurrentUser(session.userId);
  if (!user) {
    await db.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }
  let expiresAt = session.expiresAt;
  if (expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.session.update({ where: { id }, data: { expiresAt } });
  }
  return { sessionId: id, expiresAt, user };
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sha256(token) } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
