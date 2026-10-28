import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/** Recreates a SQLite file from scratch by running every Prisma migration in order. Tests and E2E only. */
export function applyMigrations(dbFile: string, migrationsDir = path.resolve("prisma/migrations")): void {
  for (const f of [dbFile, `${dbFile}-journal`, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(f, { force: true });
  const sqlite = new Database(dbFile);
  try {
    const dirs = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) sqlite.exec(fs.readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf8"));
  } finally {
    sqlite.close();
  }
}
