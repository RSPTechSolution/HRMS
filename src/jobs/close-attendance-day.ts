import "dotenv/config";
import { db } from "../lib/db";
import { closeAttendanceDay } from "../server/attendance/close-day";
import { yesterdayOf } from "../server/attendance/record";

/** Run nightly at 00:30 IST: `npm run jobs:close-day`. */
async function main(): Promise<void> {
  const day = yesterdayOf(new Date());
  const { missingCheckout, absent } = await closeAttendanceDay(day);
  console.info(`Closed ${day}: ${missingCheckout} missed check-out(s), ${absent} absence(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
