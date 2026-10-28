import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { loadCurrentUser } from "@/server/auth/users";
import { createSession, revokeAllSessions, revokeSession, SESSION_TTL_MS, validateSessionToken } from "@/server/auth/sessions";
import { makeEmployee, resetDb } from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;

describe("passwords", () => {
  it("hashes with argon2id and verifies", async () => {
    const h = await hashPassword("Password@123");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "Password@123")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });
  it("returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("loadCurrentUser", () => {
  beforeEach(resetDb);

  it("derives isManager from active direct reports", async () => {
    const boss = await makeEmployee({ name: "Ananya Sharma", isHR: true });
    await makeEmployee({ managerId: boss.employee.id, status: "EXITED" });
    expect((await loadCurrentUser(boss.user.id))?.isManager).toBe(false);
    await makeEmployee({ managerId: boss.employee.id });
    const user = await loadCurrentUser(boss.user.id);
    expect(user).toMatchObject({ fullName: "Ananya Sharma", isHR: true, isAdmin: false, isManager: true });
  });

  it("returns null for exited employees", async () => {
    const { user } = await makeEmployee({ status: "EXITED" });
    expect(await loadCurrentUser(user.id)).toBeNull();
  });
});

describe("sessions", () => {
  beforeEach(resetDb);
  const now = new Date("2026-10-28T10:00:00Z");

  it("creates a session that validates to the user, storing only a hash", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    const { token, expiresAt } = await createSession(user.id, now);
    expect(expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
    const valid = await validateSessionToken(token, now);
    expect(valid?.user.fullName).toBe("Arjun Mehta");
  });

  it("rejects unknown tokens", async () => {
    expect(await validateSessionToken("nope", now)).toBeNull();
  });

  it("rejects and deletes expired sessions", async () => {
    const { user } = await makeEmployee();
    const { token } = await createSession(user.id, now);
    const later = new Date(now.getTime() + SESSION_TTL_MS + 1);
    expect(await validateSessionToken(token, later)).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it("slides the expiry when less than 15 days remain", async () => {
    const { user } = await makeEmployee();
    const { token } = await createSession(user.id, now);
    const day20 = new Date(now.getTime() + 20 * DAY);
    const valid = await validateSessionToken(token, day20);
    expect(valid?.expiresAt.getTime()).toBe(day20.getTime() + SESSION_TTL_MS);
    const day10 = new Date(now.getTime() + 10 * DAY);
    const notRenewed = await validateSessionToken(token, day10);
    expect(notRenewed?.expiresAt.getTime()).toBe(day20.getTime() + SESSION_TTL_MS);
  });

  it("stops working as soon as the employee exits", async () => {
    const { user, employee } = await makeEmployee();
    const { token } = await createSession(user.id, now);
    await db.employee.update({ where: { id: employee.id }, data: { status: "EXITED" } });
    expect(await validateSessionToken(token, now)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("revokes one session or all of a user's sessions", async () => {
    const { user } = await makeEmployee();
    const a = await createSession(user.id, now);
    const b = await createSession(user.id, now);
    await revokeSession(a.token);
    expect(await validateSessionToken(a.token, now)).toBeNull();
    expect(await validateSessionToken(b.token, now)).not.toBeNull();
    await revokeAllSessions(user.id);
    expect(await validateSessionToken(b.token, now)).toBeNull();
  });
});
