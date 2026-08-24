import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import type { ValidatedRequest } from "../../../middlewares/zodValidator.middleware.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type {
  RegisterInput, VerifyOtpInput, LoginInput,
  ForgotPasswordInput, ForgotPasswordOtpVerifyInput, RecoverAccountOtpInput,
} from "../zodschemas/auth.zschema.js";
import {
  registerUserService, verifyOtpService, loginService,
  refreshTokenService, logoutService, deleteAccountService,
  recoverAccountService, recoverAccountOtpService,
  forgotPasswordService, forgotPasswordOtpVerifyService,
} from "../services/auth.service.js";
import type { SuccessResponse } from "../../../types/response.js";
import { COOKIE_NAMES, COOKIE_OPTIONS } from "../../../utils/token.util.js";
import { COOKIE_MAX_AGE } from "../../../constants/auth.constants.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, deviceId: string): void {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, { ...COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE.ACCESS });
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, { ...COOKIE_OPTIONS, maxAge: COOKIE_MAX_AGE.REFRESH });
  res.cookie(COOKIE_NAMES.DEVICE_ID, deviceId, { ...COOKIE_OPTIONS, httpOnly: false, maxAge: COOKIE_MAX_AGE.DEVICE_ID });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS, COOKIE_OPTIONS);
  res.clearCookie(COOKIE_NAMES.REFRESH, COOKIE_OPTIONS);
}

// ── Register ──────────────────────────────────────────────────────────────────

export const registerUserController = async (
  req: ValidatedRequest<RegisterInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await registerUserService(req.body);
    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.CREATED,
      message: "Registration successful. Please check your email for the OTP to verify your account.",
      data: null,
    };
    res.status(StatusCodes.CREATED).json(response);
  } catch (error) { next(error); }
};

// ── Verify Registration OTP ───────────────────────────────────────────────────

export const verifyOtpController = async (
  req: ValidatedRequest<VerifyOtpInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await verifyOtpService(req.body);
    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Email verified successfully. Your account is now active.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginController = async (
  req: ValidatedRequest<LoginInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const ipAddress = (req.ip ?? req.socket.remoteAddress ?? "unknown");
    const userAgent = req.headers["user-agent"] ?? "unknown";
    const existingDeviceId = req.cookies?.[COOKIE_NAMES.DEVICE_ID] as string | undefined;

    const { accessToken, refreshToken, deviceId } = await loginService(
      req.body, ipAddress, userAgent, existingDeviceId
    );

    setAuthCookies(res, accessToken, refreshToken, deviceId);

    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Login successful.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Token Refresh ─────────────────────────────────────────────────────────────

export const refreshTokenController = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as string | undefined;
    const deviceId = req.cookies?.[COOKIE_NAMES.DEVICE_ID] as string | undefined;

    if (!refreshToken) {
      throw new AppError("No refresh token provided", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_UNAUTHORIZED, { isOperational: true });
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await refreshTokenService(refreshToken);

    setAuthCookies(res, newAccessToken, newRefreshToken, deviceId ?? "");

    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Tokens refreshed successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Logout ────────────────────────────────────────────────────────────────────

export const logoutController = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as string | undefined;

    if (!refreshToken) {
      throw new AppError("No refresh token provided", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_UNAUTHORIZED, { isOperational: true });
    }

    await logoutService(authReq.auth.sessionId, authReq.auth.accessToken, refreshToken);

    clearAuthCookies(res);

    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Logged out successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Delete Account ────────────────────────────────────────────────────────────

export const deleteAccountController = async (
  req: Request, res: Response, next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as string | undefined;

    if (!refreshToken) {
      throw new AppError("No refresh token provided", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_UNAUTHORIZED, { isOperational: true });
    }

    await deleteAccountService(authReq.auth.userId, authReq.auth.accessToken, refreshToken);

    clearAuthCookies(res);

    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Account has been disabled. You have 30 days to recover it before permanent deletion.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Recover Account — Send OTP ────────────────────────────────────────────────

export const recoverAccountController = async (
  req: ValidatedRequest<ForgotPasswordInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await recoverAccountService(req.body.email);
    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "If a disabled account exists for this email, a recovery OTP has been sent.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Recover Account — Verify OTP ──────────────────────────────────────────────

export const recoverAccountOtpController = async (
  req: ValidatedRequest<RecoverAccountOtpInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await recoverAccountOtpService(req.body);
    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Account recovered successfully. Please log in.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Forgot Password — Send OTP ────────────────────────────────────────────────

export const forgotPasswordController = async (
  req: ValidatedRequest<ForgotPasswordInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await forgotPasswordService(req.body);
    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "If an account exists for this email, a password reset OTP has been sent.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};

// ── Forgot Password — Verify OTP + Reset ─────────────────────────────────────

export const forgotPasswordOtpVerifyController = async (
  req: ValidatedRequest<ForgotPasswordOtpVerifyInput>, res: Response, next: NextFunction
): Promise<void> => {
  try {
    await forgotPasswordOtpVerifyService(req.body);
    const response: SuccessResponse = {
      success: true, statusCode: StatusCodes.OK,
      message: "Password reset successfully. Please log in with your new password.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) { next(error); }
};
