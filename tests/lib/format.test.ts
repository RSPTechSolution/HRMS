import { describe, expect, it } from "vitest";
import { formatMinutes } from "@/lib/format";

describe("formatMinutes", () => {
  it("formats durations for people", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(512)).toBe("8h 32m");
  });
});
