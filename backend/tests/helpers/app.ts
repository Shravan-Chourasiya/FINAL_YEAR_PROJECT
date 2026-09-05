/**
 * tests/helpers/app.ts
 * Builds the real Express app wired to test containers.
 * Overrides the DB and Redis singletons before importing app.ts.
 */
import type { TestContainers } from "./containers.js";
import type { Express } from "express";

/**
 * Dynamically imports the real app after patching the DB/Redis module
 * singletons to point at the test containers.
 *
 * Must be called AFTER containers are started.
 */
export async function buildTestApp(containers: TestContainers): Promise<Express> {
  const { vi } = await import("vitest");

  // Patch postgres singleton
  vi.doMock("../../src/db/postgres.init.js", () => ({
    default: () => containers.db,
    getPgDb: () => containers.db,
    getPgPool: () => containers.pool,
  }));

  // Patch redis singleton
  vi.doMock("../../src/config/redis.init.js", () => ({
    redisClient: containers.redis,
  }));

  // Patch env — provide minimal required values
  vi.doMock("../../src/config/env.js", () => ({
    env: {
      NODE_ENV: "test",
      PORT: 4001,
      API_VERSION: "v1",
      JWT_SECRET: "a".repeat(64),
      CORS_ORIGIN: ["http://localhost:3000"],
      COOKIE_DOMAIN: undefined,
      LOG_LEVEL: "silent",
      APP_VERSION: "1.0.0",
    },
  }));

  // Fresh import of app after mocks are in place
  const { default: app } = await import("../../src/app.js");
  return app;
}
