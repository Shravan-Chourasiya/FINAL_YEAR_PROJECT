/**
 * tests/helpers/containers.ts
 * Spins up real Postgres + Redis containers via Testcontainers.
 * Call setup() in beforeAll, teardown() in afterAll.
 *
 * Requires:
 *   npm install -D @testcontainers/postgresql @testcontainers/redis testcontainers
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { Redis } from "ioredis";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sql } from "drizzle-orm";

// Disable Ryuk (resource reaper) — avoids Docker socket permission issues on Windows
process.env.TESTCONTAINERS_RYUK_DISABLED = "true";
// Only pull images if not already present
process.env.TESTCONTAINERS_PULL_POLICY = "missing";
// Windows Docker Desktop named pipe
if (process.platform === "win32" && !process.env.DOCKER_HOST) {
  process.env.DOCKER_HOST = "npipe:////./pipe/docker_engine";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_PATH = join(__dirname, "../../src/db/migrations");

export interface TestContainers {
  pgContainer: StartedPostgreSqlContainer;
  redisContainer: StartedRedisContainer;
  db: ReturnType<typeof drizzle>;
  pool: Pool;
  redis: Redis;
}

let containers: TestContainers | null = null;

export async function setup(): Promise<TestContainers> {
  const [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer("postgres:16-alpine").start(),
    new RedisContainer("redis:7-alpine").start(),
  ]);

  const pool = new Pool({ connectionString: pgContainer.getConnectionUri() });
  const db = drizzle({ client: pool });

  await migrate(db, { migrationsFolder: MIGRATIONS_PATH });

  const redis = new Redis({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
    lazyConnect: false,
  });

  containers = { pgContainer, redisContainer, db, pool, redis };
  return containers;
}

export async function teardown(): Promise<void> {
  if (!containers) return;
  await containers.redis.quit();
  await containers.pool.end();
  await Promise.all([
    containers.pgContainer.stop(),
    containers.redisContainer.stop(),
  ]);
  containers = null;
}

export function getContainers(): TestContainers {
  if (!containers) throw new Error("Containers not started — call setup() first");
  return containers;
}

/**
 * Truncate all user-data tables between tests.
 * Order matters — sessions references users via FK.
 */
export async function resetDb(): Promise<void> {
  const { db } = getContainers();
  await db.execute(sql`
    TRUNCATE TABLE sessions, interviews, users RESTART IDENTITY CASCADE
  `);
}

/**
 * Flush all Redis keys between tests.
 */
export async function resetRedis(): Promise<void> {
  const { redis } = getContainers();
  await redis.flushall();
}
