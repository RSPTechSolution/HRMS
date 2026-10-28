import { applyMigrations } from "../../prisma/apply-migrations";

export default function setup(): void {
  applyMigrations("./test.db");
}
