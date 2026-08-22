import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getPgDb, getPgPool } from "../postgres.init.js";
import { env } from "../../config/env.js";

async function main() {
  const db = getPgDb();
  const pool = getPgPool();

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  await pool.end();
  console.log("Migrations applied and connection closed");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
