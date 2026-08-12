import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { StatusCodes } from "http-status-codes";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => {
  res.status(StatusCodes.OK).json({ status: "ok", env: env.NODE_ENV });
});

app.listen(env.PORT, () => {
  logger.info(`SynthView AI backend listening on port ${env.PORT}`);
});
