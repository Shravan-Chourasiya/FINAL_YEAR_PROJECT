import express from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { csrfTokenMiddleware } from "../middlewares/csrf.middleware.js";
import { requireOwnership } from "../middlewares/ownership.middleware.js";
import { validateBody } from "../middlewares/zodValidator.middleware.js";
import { createInterviewSchema } from "../modules/interview/zodschemas/interview.zschema.js";
import {
  createInterviewController,
  getAllInterviewsController,
  getInterviewByIdController,
  getInterviewMetricsController,
} from "../modules/interview/controller/interview.controller.js";
import { fetchInterviewById } from "../modules/interview/services/interview.service.js";

const InterviewLimiter = createRateLimiter("INTERVIEW");
const CreateInterviewLimiter = createRateLimiter("CREATE_INTERVIEW");

const requireInterviewOwnership = requireOwnership(
  fetchInterviewById,
  (interview) => interview.userId,
);

export function createInterviewRouter() {
  const router = express.Router();

  router.post(
    "/interviews",
    requireAuth,
    csrfTokenMiddleware,
    CreateInterviewLimiter,
    validateBody(createInterviewSchema),
    createInterviewController,
  );

  router.get("/interviews", requireAuth, csrfTokenMiddleware, InterviewLimiter, getAllInterviewsController);

  router.get(
    "/interviews/:id",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    getInterviewByIdController,
  );

  router.get(
    "/interviews/:id/metrics",
    requireAuth,
    csrfTokenMiddleware,
    InterviewLimiter,
    requireInterviewOwnership,
    getInterviewMetricsController,
  );

  return router;
}
