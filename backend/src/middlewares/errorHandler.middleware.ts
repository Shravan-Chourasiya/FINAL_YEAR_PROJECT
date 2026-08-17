import { type ErrorRequestHandler, type NextFunction, type Request } from "express";
import { StatusCodes } from "http-status-codes";

import { logger } from "../utils/logger.js";
import type { ErrorResponse } from "../types/response.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import type { StandardRequest } from "../types/request.js";
import { JsonWebTokenError, NotBeforeError, TokenExpiredError } from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

function getRoutePath(req: Request): string | undefined {
  const route = (req as { route?: { path?: string } }).route;
  return route?.path;
}

export function toErrorLike(value: unknown): {
  name: string;
  message: string;
  stack: string | undefined;
} {
  if (value instanceof Error) {
    // JWT errors
    if (value instanceof JsonWebTokenError) {
      return { name: "JWTError", message: value.message, stack: value.stack };
    }
    if (value instanceof TokenExpiredError) {
      return { name: "JWTExpiredError", message: value.message, stack: value.stack };
    }
    if (value instanceof NotBeforeError) {
      return { name: "JWTNotBeforeError", message: value.message, stack: value.stack };
    }

    // Nodemailer errors (often just Error with a code)
    if ("code" in value && typeof value.code === "string") {
      return {
        name: `NodemailerError:${value.code}`,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value.name?.toLowerCase().includes("langchain")) {
      return { name: "LangChainError", message: value.message, stack: value.stack };
    }

    // Generic Error fallback
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (typeof value === "string") {
    return { name: "Error", message: value, stack: undefined };
  }

  return { name: "UnknownError", message: String(value), stack: undefined };
}

/**
 * Centralized Express error-handling middleware.
 *
 * This middleware:
 * - Catches AppError and maps it to the standard ErrorResponse envelope.
 * - Catches unexpected errors and produces a sanitized 500 response.
 * - Logs unexpected errors with useful context.
 * - Never exposes internal implementation details to clients.
 * - Never exposes stack traces to clients.
 * - Never exposes database/Redis/infrastructure internals.
 *
 * **Must be registered LAST** among Express middleware that handles requests.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next: NextFunction) => {
  const sreq = req as StandardRequest;
  // Log unexpected errors with structured context
  if (!(err instanceof AppError)) {
    const errorObj = toErrorLike(err);
    logger.error(
      {
        requestId: sreq._id,
        method: sreq.method,
        path: sreq.path,
        route: getRoutePath(sreq),
        ...(sreq.userId && { userId: sreq.userId }),
        ...(sreq.userRole && { role: sreq.userRole }),
        error: {
          name: errorObj.name,
          message: errorObj.message,
          stack: errorObj.stack,
        },
      },
      "Unexpected error",
    );
  }

  // Map AppError to the standard error envelope
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      statusCode: err.statusCode,
      message: err.message,
      data: null,
      error: {
        code: err.errorCode,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    return res.status(err.statusCode).json(response);
  }

  // Map unexpected errors to a sanitized 500 response
  const response: ErrorResponse = {
    success: false,
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: "An unexpected error occurred",
    data: null,
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
    },
  };
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};
