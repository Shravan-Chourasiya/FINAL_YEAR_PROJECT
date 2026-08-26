import express from "express";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { createInterviewController, getAllInterviewsController, getInterviewByIdController, getInterviewMetricsController } from "../modules/interview/controller/interview.controller.js";
import { validateBody } from "../middlewares/zodValidator.middleware.js";
import { createInterviewSchema } from "../modules/interview/zodschemas/interview.zschema.js";

const InterviewLimiter = createRateLimiter("INTERVIEW");
const CreateInterviewLimiter = createRateLimiter("CREATE_INTERVIEW");

export function createInterviewRouter() {
  const router = express.Router();

  router.post("/interviews", requireAuth, CreateInterviewLimiter,validateBody(createInterviewSchema), createInterviewController);

  router.get("/interview", requireAuth, InterviewLimiter, getAllInterviewsController);
  
  router.get("/interviews/:id", requireAuth, InterviewLimiter,getInterviewByIdController);
  
  router.get(
    "/interviews/:id/metrics",
    requireAuth,
    InterviewLimiter,
    getInterviewMetricsController,
  );

  return router;
}
