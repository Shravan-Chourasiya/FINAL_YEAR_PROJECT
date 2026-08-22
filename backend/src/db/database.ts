import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";

export const db = drizzle(env.POSTGRES_URI!, { logger: true });

export async function createDbInstanceForSchema(schemaName: string) {
  await db.execute(sql.raw(`SET search_path TO "${schemaName}"`));
  return db;
}
