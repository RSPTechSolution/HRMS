export const DOCUMENT_CATEGORIES = ["ID_PROOF", "ADDRESS_PROOF", "EDUCATION", "EXPERIENCE", "OFFER_LETTER", "OTHER"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  ID_PROOF: "ID proof",
  ADDRESS_PROOF: "Address proof",
  EDUCATION: "Education",
  EXPERIENCE: "Experience",
  OFFER_LETTER: "Offer / appointment letter",
  OTHER: "Other",
};

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type AllowedMime = "application/pdf" | "image/png" | "image/jpeg";

export function isDocumentCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

/** Decides the type from the file's own bytes; the name and the browser's claim are ignored. */
export function sniffFileType(bytes: Uint8Array): AllowedMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

/** A display name only (files are stored under random keys): letters, digits, . - _ and spaces, max 120. */
export function safeFileName(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9._\- ]/g, "").replace(/^[.\s]+/, "").trim().slice(0, 120);
  return clean || "document";
}
