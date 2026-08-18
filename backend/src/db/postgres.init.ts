import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { Pool, type PoolConfig } from "pg";

let pool: Pool | undefined;
let db: ReturnType<typeof drizzle> | undefined;

export function getPgDbConn() {
  if (db) {
    return db;
  }

  if (!pool) {
    const poolConfig: PoolConfig = {
      connectionString: env.POSTGRES_URI,
      ssl: {
        rejectUnauthorized: true,
      },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
    };

    pool = new Pool(poolConfig);
  }

  db = drizzle({ client: pool });
  return db;
}

export async function testPgConnection() {
  const pgDb = getPgDbConn();
  const result = await pgDb.execute("select 1");
  if (result?.rows.length > 0) {
    logger.info("PostgreSQL connection successful.");
    return true;
  }
  logger.error("PostgreSQL connection check returned no rows.");
  return false;
}

export function getPgPool() {
  if (!pool) {
    getPgDbConn();
  }

  return pool as Pool;
}

export default getPgDbConn;
