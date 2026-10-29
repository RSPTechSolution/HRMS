import "dotenv/config";
import { db } from "../../src/lib/db";
import { DEMO_LOGINS, DEMO_PASSWORD } from "./data";
import { seed } from "./seed";

async function main(): Promise<void> {
  const { employees } = await seed(db);
  console.info(`Seeded ${employees} employees.\n\nDemo logins (password ${DEMO_PASSWORD}):`);
  for (const l of DEMO_LOGINS) console.info(`  ${l.email.padEnd(28)} ${l.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
