import { applyMigrations } from "../../prisma/apply-migrations";

async function main(): Promise<void> {
  process.env.DATABASE_URL = "file:./e2e.db";
  applyMigrations("./e2e.db");
  const { db } = await import("../../src/lib/db");
  const { seed } = await import("../../prisma/seed/seed");
  await seed(db);
  await db.$disconnect();
  console.info("E2E database ready.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
