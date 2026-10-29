import { describe, expect, it } from "vitest";
import { safeFileName, sniffFileType } from "@/domain/documents/files";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

describe("sniffFileType", () => {
  it("recognises PDF, PNG and JPEG by their first bytes", () => {
    expect(sniffFileType(text("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
  });
  it("rejects anything else, whatever it is called", () => {
    expect(sniffFileType(text("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffFileType(bytes())).toBeNull();
  });
});

describe("safeFileName", () => {
  it("strips paths and odd characters", () => {
    const name = safeFileName("../../etc/passwd");
    expect(name).not.toMatch(/[\\/]/);
    expect(safeFileName('my "offer"<letter>.pdf')).toBe("my offerletter.pdf");
    expect(safeFileName("")).toBe("document");
    expect(safeFileName(`${"a".repeat(200)}.pdf`)).toHaveLength(120);
  });
});
