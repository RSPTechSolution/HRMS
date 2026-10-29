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

/** Files live outside public/ under random hex names, so no user input ever reaches a path. */
export function localFileStore(root = process.env.STORAGE_DIR ?? "storage"): FileStore {
  const pathFor = (key: string) => {
    if (!KEY.test(key)) throw new Error("Invalid storage key");
    return path.join(root, key);
  };
  return {
    async save(bytes) {
      await mkdir(root, { recursive: true });
      const key = randomBytes(16).toString("hex");
      await writeFile(pathFor(key), bytes, { flag: "wx" });
      return key;
    },
    async read(key) {
      return new Uint8Array(await readFile(pathFor(key)));
    },
    async remove(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}
