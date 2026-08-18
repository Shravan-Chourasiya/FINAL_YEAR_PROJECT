import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";
import { env } from "./config/env.js";
import { requestLogger } from "./utils/logger.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import { ErrorCodes } from "./constants/errorCodes.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import getPgDbConn from "./db/postgres.init.js";

const app = express();
const dbconn= getPgDbConn();


//****************************************** Middleware Configuration ******************************************//
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);

//****************************************** Route Registration ******************************************//
const AuthRoutes: express.Router = createAuthRouter();
app.use(`/${env.API_VERSION}/`, AuthRoutes);

app.get("/health", (_req, res) => {
  res.status(StatusCodes.OK).json({ status: "ok", env: env.NODE_ENV });
});

//****************************************** 404 Handler ******************************************//
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

//****************************************** Error Handling Middleware ******************************************//
app.use(errorHandler);

//****************************************** Export the Express App ******************************************//
export default app;
