import type { Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/appError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { verifyToken, isTokenBlacklisted, COOKIE_NAMES } from "../utils/token.util.js";
import type { AuthenticatedRequest } from "../types/request.js";
import type { Request } from "express";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req as AuthenticatedRequest).cookies?.[COOKIE_NAMES.ACCESS] as string | undefined;

    if (!token) {
      throw new AppError("Authentication required", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_UNAUTHORIZED, { isOperational: true });
    }

    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw new AppError("Session has been revoked", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_SESSION_EXPIRED, { isOperational: true });
    }

    const payload = verifyToken(token);

    if (payload.type !== "access") {
      throw new AppError("Invalid token type", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_UNAUTHORIZED, { isOperational: true });
    }

    const authReq = req as AuthenticatedRequest;
    authReq.auth = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      tokenFamily: payload.tokenFamily,
      accessToken: token,
      refreshToken: authReq.cookies?.[COOKIE_NAMES.REFRESH] as string ?? "",
    };
    authReq.userId = payload.userId;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    // JWT errors (expired, malformed)
    next(new AppError("Invalid or expired session", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_SESSION_EXPIRED, { isOperational: true }));
  }
}
