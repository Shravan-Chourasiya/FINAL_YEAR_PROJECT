// scripts/migrate.ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../../config/env.js";

async function main() {
  const db = drizzle(env.POSTGRES_URI!);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  console.log("Migrations applied and connection closed");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
