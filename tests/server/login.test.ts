import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/server/auth/login";
import { hashPassword } from "@/server/auth/password";
import { makeEmployee, resetDb } from "../helpers/db";

const PASSWORD = "Password@123";

describe("authenticate", () => {
  let passwordHash = "";
  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });
  beforeEach(resetDb);
  const now = new Date("2026-10-28T10:00:00Z");
  const minutes = (m: number) => new Date(now.getTime() + m * 60_000);

  it("accepts the right password, ignoring email case and spaces", async () => {
    const { user } = await makeEmployee({ passwordHash });
    const result = await authenticate(`  ${user.email.toUpperCase()} `, PASSWORD, now);
    expect(result).toEqual({ ok: true, userId: user.id });
  });

  it("rejects a wrong password", async () => {
    const { user } = await makeEmployee({ passwordHash });
    expect(await authenticate(user.email, "wrong-password", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects unknown emails and users without a password the same way", async () => {
    const { user } = await makeEmployee({ passwordHash: null });
    expect(await authenticate("nobody@lnwebworks.test", PASSWORD, now)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate(user.email, PASSWORD, now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects exited employees", async () => {
    const { user } = await makeEmployee({ passwordHash, status: "EXITED" });
    expect(await authenticate(user.email, PASSWORD, now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after five failures, even for the right password, and records every attempt", async () => {
    const { user } = await makeEmployee({ passwordHash });
    for (let i = 0; i < 5; i++) await authenticate(user.email, "wrong-password", minutes(i));
    expect(await authenticate(user.email, PASSWORD, minutes(5))).toEqual({ ok: false, reason: "locked" });
    expect(await db.loginAttempt.count({ where: { email: user.email } })).toBe(5);
  });

  it("does not let parallel guesses slip past the five-try limit", async () => {
    const { user } = await makeEmployee({ passwordHash });
    const results = await Promise.all(Array.from({ length: 8 }, () => authenticate(user.email, "wrong-password", now)));
    const verified = results.filter((r) => !r.ok && r.reason === "invalid").length;
    expect(verified).toBeLessThanOrEqual(5);
  });

  it("unlocks 15 minutes after the last failure", async () => {
    const { user } = await makeEmployee({ passwordHash });
    for (let i = 0; i < 5; i++) await authenticate(user.email, "wrong-password", minutes(i));
    expect(await authenticate(user.email, PASSWORD, minutes(4 + 15))).toEqual({ ok: true, userId: user.id });
  });
});
