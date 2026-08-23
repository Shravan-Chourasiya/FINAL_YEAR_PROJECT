import { Router } from "express";
import { validateBody } from "../middlewares/zodValidator.middleware.js";
import { registerSchema, verifyOtpSchema } from "../modules/auth/zodschemas/auth.zschema.js";
import { registerUserController, verifyOtpController } from "../modules/auth/controllers/auth.controller.js";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";

const authLimiter = createRateLimiter("AUTH");
const otpVerifyLimiter = createRateLimiter("OTP_VERIFY");

export const createAuthRouter = (): Router => {
  const router = Router();

  router.post("/auth/register", authLimiter, validateBody(registerSchema), registerUserController);
  router.post("/auth/verify-otp", otpVerifyLimiter, validateBody(verifyOtpSchema), verifyOtpController);

  return router;
};
