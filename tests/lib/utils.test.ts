import { describe, expect, it } from "vitest";
import { generateToken, sha256 } from "@/lib/crypto";
import { safeNext } from "@/lib/safe-next";
import { avatarColor, initials } from "@/lib/avatar";
import { formatIsoDate, greetingFor, longDateIST, timeAgo } from "@/lib/time";

describe("crypto", () => {
  it("generates unique url-safe tokens", () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });
  it("hashes deterministically", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("safeNext", () => {
  it("keeps internal paths", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/people/abc?tab=leave")).toBe("/people/abc?tab=leave");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "", null, undefined, "/login", "settings"])(
    "falls back to /home for %s",
    (value) => {
      expect(safeNext(value as string | null | undefined)).toBe("/home");
    },
  );
});

describe("avatar", () => {
  it("builds initials from first and last name", () => {
    expect(initials("Arjun Mehta")).toBe("AM");
    expect(initials("Neha")).toBe("N");
    expect(initials("  ananya   kumari sharma ")).toBe("AS");
    expect(initials("   ")).toBe("?");
  });
  it("picks a stable colour from the palette", () => {
    expect(avatarColor("Arjun Mehta")).toBe(avatarColor("Arjun Mehta"));
    expect(avatarColor("Arjun Mehta")).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("time (IST)", () => {
  it("greets by IST hour", () => {
    expect(greetingFor(new Date("2026-10-28T03:30:00Z"))).toBe("Good morning"); // 09:00 IST
    expect(greetingFor(new Date("2026-10-28T08:00:00Z"))).toBe("Good afternoon"); // 13:30 IST
    expect(greetingFor(new Date("2026-10-28T12:30:00Z"))).toBe("Good evening"); // 18:00 IST
  });
  it("formats the long date", () => {
    expect(longDateIST(new Date("2026-10-28T03:30:00Z"))).toBe("Wednesday 28 October");
  });
  it("describes relative time", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    expect(timeAgo(new Date("2026-10-28T09:59:30Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-10-28T09:48:00Z"), now)).toBe("12 min ago");
    expect(timeAgo(new Date("2026-10-28T07:00:00Z"), now)).toBe("3 h ago");
    expect(timeAgo(new Date("2026-10-27T09:00:00Z"), now)).toBe("Yesterday");
    expect(timeAgo(new Date("2026-10-24T10:00:00Z"), now)).toBe("4 days ago");
    expect(timeAgo(new Date("2026-10-01T10:00:00Z"), now)).toBe("1 Oct");
  });
  it("formats calendar dates without timezone drift", () => {
    expect(formatIsoDate("2025-01-01")).toBe("1 January 2025");
    expect(formatIsoDate("2026-12-31")).toBe("31 December 2026");
  });
});
