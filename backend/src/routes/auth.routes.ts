import { Router } from "express";
import { validateBody } from "../middlewares/zodValidator.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { createRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import {
  registerSchema, verifyOtpSchema, loginSchema,
  forgotPasswordSchema, forgotPasswordOtpVerifySchema, recoverAccountOtpSchema,
  updatePasswordSchema,updateEmailSchema, emailUpdateOtpVerifySchema,
} from "../modules/auth/zodschemas/auth.zschema.js";
import {
  registerUserController, verifyOtpController, loginController,
  refreshTokenController, logoutController, deleteAccountController,
  recoverAccountController, recoverAccountOtpController,
  forgotPasswordController, forgotPasswordOtpVerifyController,
  updatePasswordController,
  emailUpdateOtpVerifyController,
  updateEmailController,
} from "../modules/auth/controllers/auth.controller.js";

const authLimiter        = createRateLimiter("AUTH");
const otpVerifyLimiter   = createRateLimiter("OTP_VERIFY");
const otpResendLimiter   = createRateLimiter("OTP_RESEND");
const passwordLimiter    = createRateLimiter("PASSWORD_RESET");

export const createAuthRouter = (): Router => {
  const router = Router();

  // ── Registration ────────────────────────────────────────────────────────────
  router.post("/auth/register",
    authLimiter,
    validateBody(registerSchema),
    registerUserController,
  );

  router.post("/auth/verify-otp",
    otpVerifyLimiter,
    validateBody(verifyOtpSchema),
    verifyOtpController,
  );

  // ── Login / Logout ───────────────────────────────────────────────────────────
  router.post("/auth/login",
    authLimiter,
    validateBody(loginSchema),
    loginController,
  );

  router.post("/auth/refresh",
    authLimiter,
    refreshTokenController,
  );

  router.post("/usr/logout",
    requireAuth,
    logoutController,
  );

  // ── Account Management ───────────────────────────────────────────────────────
  router.delete("/usr/account",
    requireAuth,
    deleteAccountController,
  );

  router.post("/auth/recover-account",
    otpResendLimiter,
    validateBody(forgotPasswordSchema),
    recoverAccountController,
  );

  router.post("/auth/recover-account/verify",
    otpVerifyLimiter,
    validateBody(recoverAccountOtpSchema),
    recoverAccountOtpController,
  );

  // ── Forgot Password ──────────────────────────────────────────────────────────
  router.post("/auth/forgot-password",
    passwordLimiter,
    validateBody(forgotPasswordSchema),
    forgotPasswordController,
  );

  router.post("/auth/forgot-password/verify",
    otpVerifyLimiter,
    validateBody(forgotPasswordOtpVerifySchema),
    forgotPasswordOtpVerifyController,
  );

  // ── Update Password ──────────────────────────────────────────────────────────
  router.post("/usr/update-password",
    passwordLimiter,
    validateBody(updatePasswordSchema),
    updatePasswordController,
  );

  // ── Update Email ──────────────────────────────────────────────────────────
  router.post(
    "/usr/update-email",
    passwordLimiter,
    validateBody(updateEmailSchema),
    updateEmailController,
  );

  router.post("/usr/update-email/verify",
    passwordLimiter,
    validateBody(updateEmailSchema),
    emailUpdateOtpVerifyController,
  );

  return router;
};
