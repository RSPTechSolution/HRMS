import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { outbox } from "@/server/mail/mailer";
import { createSession } from "@/server/auth/sessions";
import { verifyPassword } from "@/server/auth/password";
import {
  consumePasswordToken,
  issuePasswordToken,
  peekPasswordToken,
  requestPasswordReset,
  sendSetPasswordEmail,
} from "@/server/auth/password-tokens";
import { makeEmployee, resetDb } from "../helpers/db";

const tokenFrom = (text: string): string => /token=([A-Za-z0-9_-]+)/.exec(text)![1];
const now = new Date("2026-10-28T10:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("password tokens", () => {
  beforeEach(async () => {
    await resetDb();
    outbox.length = 0;
  });

  it("emails a set-password link that sets the password and revokes old sessions", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    await createSession(user.id, now);
    await sendSetPasswordEmail(user.id, now);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
    expect(outbox[0].text).toContain("Hi Arjun");
    const token = tokenFrom(outbox[0].text);

    expect(await peekPasswordToken(token, now)).toEqual({ purpose: "SET", email: user.email });
    const result = await consumePasswordToken(token, "Brand-new-pass1", hours(1));
    expect(result).toEqual({ ok: true, userId: user.id });

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(stored.passwordHash!, "Brand-new-pass1")).toBe(true);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses a token twice", async () => {
    const { user } = await makeEmployee();
    const token = await issuePasswordToken(user.id, "SET", now);
    expect((await consumePasswordToken(token, "Brand-new-pass1", now)).ok).toBe(true);
    expect(await consumePasswordToken(token, "Another-pass-22", now)).toEqual({
      ok: false,
      error: "This link has expired or was already used. Ask for a new one.",
    });
  });

  it("expires reset links after one hour and set links after 72 hours", async () => {
    const { user } = await makeEmployee();
    const reset = await issuePasswordToken(user.id, "RESET", now);
    expect(await peekPasswordToken(reset, hours(1.01))).toBeNull();
    const set = await issuePasswordToken(user.id, "SET", now);
    expect(await peekPasswordToken(set, hours(71))).not.toBeNull();
    expect((await consumePasswordToken(set, "Brand-new-pass1", hours(73))).ok).toBe(false);
  });

  it("issuing a new token invalidates the previous one of the same purpose", async () => {
    const { user } = await makeEmployee();
    const first = await issuePasswordToken(user.id, "RESET", now);
    const second = await issuePasswordToken(user.id, "RESET", now);
    expect(await peekPasswordToken(first, now)).toBeNull();
    expect(await peekPasswordToken(second, now)).not.toBeNull();
  });

  it("keeps the token usable when the new password breaks the policy", async () => {
    const { user } = await makeEmployee();
    const token = await issuePasswordToken(user.id, "SET", now);
    expect(await consumePasswordToken(token, "short", now)).toEqual({ ok: false, error: "Use at least 10 characters." });
    expect((await consumePasswordToken(token, "Long-enough-pass", now)).ok).toBe(true);
  });

  it("sends reset mail only to active known accounts", async () => {
    await requestPasswordReset("nobody@lnwebworks.test", now);
    const exited = await makeEmployee({ status: "EXITED" });
    await requestPasswordReset(exited.user.email, now);
    expect(outbox).toHaveLength(0);

    const { user } = await makeEmployee();
    await requestPasswordReset(user.email.toUpperCase(), now);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toBe("Reset your LN People password");
    expect(await peekPasswordToken(tokenFrom(outbox[0].text), now)).toEqual({ purpose: "RESET", email: user.email });
  });
});
