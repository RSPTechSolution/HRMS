import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type FileStore = {
  save(bytes: Uint8Array): Promise<string>;
  read(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
};

const KEY = /^[a-f0-9]{32}$/;

function checked(key: string): string {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
  return key;
}

/**
 * Files live in ./storage (outside public/) under random hex names, so no user input reaches a path.
 * The path is written out statically so the build doesn't trace the whole project into the server bundle.
 */
export function localFileStore(): FileStore {
  return {
    async save(bytes) {
      await mkdir(path.join(process.cwd(), "storage"), { recursive: true });
      const key = randomBytes(16).toString("hex");
      await writeFile(path.join(process.cwd(), "storage", key), bytes, { flag: "wx" });
      return key;
    },
    async read(key) {
      return new Uint8Array(await readFile(path.join(process.cwd(), "storage", checked(key))));
    },
    async remove(key) {
      await rm(path.join(process.cwd(), "storage", checked(key)), { force: true });
    },
  };
}
