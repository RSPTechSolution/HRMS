import { randomBytes } from "node:crypto";
import type { FileStore } from "@/server/documents/store";

/** In-memory FileStore for tests. */
export function memoryFileStore(): FileStore & { size(): number } {
  const files = new Map<string, Uint8Array>();
  return {
    async save(bytes) {
      const key = randomBytes(16).toString("hex");
      files.set(key, bytes);
      return key;
    },
    async read(key) {
      const bytes = files.get(key);
      if (!bytes) throw new Error("No such file");
      return bytes;
    },
    async remove(key) {
      files.delete(key);
    },
    size: () => files.size,
  };
}
