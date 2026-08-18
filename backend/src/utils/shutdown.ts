import type { Server } from "node:http";
import { logger } from "./logger.js";
import { getPgPool } from "../db/postgres.init.js";


const SHUTDOWN_TIMEOUT_MS = 10_000;

let isShuttingDown = false;

export async function gracefulShutdown(server: Server, signal: NodeJS.Signals): Promise<void> {
  // Prevent multiple signals from running shutdown simultaneously.
  if (isShuttingDown) {
    logger.warn({ signal }, "Shutdown already in progress");

    return;
  }

  isShuttingDown = true;

  logger.info({ signal }, "Graceful shutdown initiated");

  // Safety timeout. If something refuses to close,
  // don't keep the process alive forever.
  const forceShutdownTimer = setTimeout(() => {
    logger.error(
      {
        timeoutMs: SHUTDOWN_TIMEOUT_MS,
      },
      "Graceful shutdown timed out; forcing process termination",
    );

    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Do not keep the Node.js event loop alive because of this timer.
  forceShutdownTimer.unref();

  try {
  
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    logger.info("HTTP server closed");

    await getPgPool().end();
    logger.info("PostgreSQL pool closed");

    // await disconnectRedis();
    // logger.info("Redis connection closed");

  
    clearTimeout(forceShutdownTimer);

    logger.info("Graceful shutdown completed");

    process.exitCode = 0;
  } catch (error) {
    clearTimeout(forceShutdownTimer);

    logger.fatal(
      {
        err: error,
        signal,
      },
      "Graceful shutdown failed",
    );

    process.exitCode = 1;
  }
}
