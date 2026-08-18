import { gracefulShutdown } from "./src/utils/shutdown.js";
import { env } from "./src/config/env.js";
import { logger } from "./src/utils/logger.js";
import app from "./src/app.js";
import { testPgConnection } from "./src/db/postgres.init.js";

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    `HTTP server started on ${env.PORT} in ${env.NODE_ENV} mode`,
  );

  void testPgConnection().catch((err: unknown) => {
    logger.error({ err }, "PostgreSQL connection failed on startup");
  });
});

process.once("SIGTERM", () => {
  void gracefulShutdown(server, "SIGTERM");
});

process.once("SIGINT", () => {
  void gracefulShutdown(server, "SIGINT");
});
