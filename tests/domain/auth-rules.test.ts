import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/domain/auth/password-policy";
import { isLockedOut, LOCK_WINDOW_MS, type Attempt } from "@/domain/auth/lockout";

describe("validateNewPassword", () => {
  it("accepts a reasonable password", () => {
    expect(validateNewPassword("Password@123", "arjun@lnwebworks.test")).toBeNull();
  });
  it("rejects short passwords", () => {
    expect(validateNewPassword("short", "a@b.test")).toBe("Use at least 10 characters.");
  });
  it("rejects the email as password, ignoring case", () => {
    expect(validateNewPassword("Arjun@LNWebworks.test", "arjun@lnwebworks.test")).toBe("Your password can't be your email address.");
  });
  it("rejects absurdly long passwords", () => {
    expect(validateNewPassword("x".repeat(201), "a@b.test")).toBe("That password is too long.");
  });
});

describe("isLockedOut", () => {
  const now = new Date("2026-10-28T10:00:00Z");
  const ago = (ms: number): Date => new Date(now.getTime() - ms);
  const fail = (ms: number): Attempt => ({ success: false, at: ago(ms) });

  it("is not locked with fewer than five consecutive failures", () => {
    expect(isLockedOut([fail(1000), fail(2000), fail(3000), fail(4000)], now)).toBe(false);
  });
  it("locks after five consecutive failures", () => {
    expect(isLockedOut([fail(1000), fail(2000), fail(3000), fail(4000), fail(5000)], now)).toBe(true);
  });
  it("a success resets the count", () => {
    const attempts = [fail(1000), fail(2000), { success: true, at: ago(3000) }, fail(4000), fail(5000), fail(6000)];
    expect(isLockedOut(attempts, now)).toBe(false);
  });
  it("unlocks 15 minutes after the last failure", () => {
    const old = [1, 2, 3, 4, 5].map((i) => fail(LOCK_WINDOW_MS + i * 1000));
    expect(isLockedOut(old, now)).toBe(false);
  });
  it("does not depend on input order", () => {
    expect(isLockedOut([fail(5000), fail(1000), fail(3000), fail(2000), fail(4000)], now)).toBe(true);
  });
});
