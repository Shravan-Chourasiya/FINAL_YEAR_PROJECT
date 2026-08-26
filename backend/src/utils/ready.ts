import { sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { StatusCodes } from "http-status-codes";

export async function readinessCheck(dbConn: any, redisClient: any) {
  const checks: Record<string, "ok" | "error"> = {};
  let healthy = true;

  try {
    await dbConn.execute(sql`select 1`);
    checks.database = "ok";
  } catch (err) {
    logger.error({ err }, "Readiness check: database ping failed");
    checks.database = "error";
    healthy = false;
  }

  try {
    await redisClient.ping();
    checks.redis = "ok";
  } catch (err) {
    logger.error({ err }, "Readiness check: redis ping failed");
    checks.redis = "error";
    healthy = false;
  }

  const statusCode = healthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
  return { checks, statusCode, healthy };
}
