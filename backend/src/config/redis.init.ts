import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
  retryStrategy(times: number) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
  maxRetriesPerRequest: 3,
};



const redisClient = new Redis(redisConfig);

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("error", (err) => logger.error({ cause: err }, "Redis error"));

export { redisClient };
