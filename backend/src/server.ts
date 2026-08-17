import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";

import { env } from "./config/env.js";
import { logger, requestLogger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";

import { ErrorCodes } from "./constants/errorCodes.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { gracefulShutdown } from "./utils/shutdown.js";
import { createAuthRouter } from "./routes/auth.routes.js";

const app = express();

const AuthRoutes:express.Router=createAuthRouter();


app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Register custom request logger
app.use(requestIdMiddleware);
app.use(requestLogger);

// 404 handler
app.use((_req, res) => {
  res.status(StatusCodes.NOT_FOUND).json({
    status: "error",
    statusCode: StatusCodes.NOT_FOUND,
    message: "Route not found",
    error: {
      code: ErrorCodes.ROUTE_NOT_FOUND,
    },
  });
});

// Central error handler (MUST be registered last)
app.use(errorHandler);


app.use(`${env.BASE_URL}/${env.API_VERSION}/`,AuthRoutes)

app.get("/health", (_req, res) => {
  res.status(StatusCodes.OK).json({ status: "ok", env: env.NODE_ENV });
});


const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    `HTTP server started on ${env.PORT} in ${env.NODE_ENV} mode`,
  );
});

process.once("SIGTERM", () => {
  void gracefulShutdown(server, "SIGTERM");
});

process.once("SIGINT", () => {
  void gracefulShutdown(server, "SIGINT");
});