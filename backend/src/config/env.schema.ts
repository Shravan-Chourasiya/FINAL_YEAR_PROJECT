import * as z from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  POSTGRES_URI: z.string().url(),
  REDIS_URI: z.string().url(),
  JWT_SECRET: z.string().min(64).max(512),
  CORS_ORIGIN: z.string().url(),
  COOKIE_DOMAIN: z.string().optional(),
  BASE_URL:z.string().url(),
  API_VERSION:z.string()
});

export default envSchema;
