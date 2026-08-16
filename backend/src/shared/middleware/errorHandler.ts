import { type ErrorRequestHandler, type Request } from "express";
import { StatusCodes } from "http-status-codes";

import { ErrorCodes } from "../../constants/errorCodes.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";
import { type ErrorResponse } from "../../types/response.js";


/**
 * Safely extract the route path from an Express request.
 * req.route is set at runtime by Express 5 but is not in @types/express.
 */
function getRoutePath(req: Request): string | undefined {
  const route = (req as { route?: { path?: string } }).route;
  return route?.path;
}

/**
 * Convert an unknown thrown value into a minimal Error-like shape.
 * `err` may be `null`, a string, or an object — never trust its type.
 */
function toErrorLike(value: unknown): { name: string; message: string; stack: string | undefined } {
  if (value instanceof Error) {
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
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  // Log unexpected errors with structured context
  if (!(err instanceof AppError)) {
    const errorObj = toErrorLike(err);
    logger.error(
      {
        requestId: req.id,
        method: req.method,
        path: req.path,
        route: getRoutePath(req),
        ...(req.userId && { userId: req.userId as string }),
        ...(req.role && { role: req.role as string }),
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
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
      error: {
        code: err.errorCode,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    return res.status(err.statusCode).json(response);
  }

  // Map unexpected errors to a sanitized 500 response
  const response: ErrorResponse = {
    status: "error",
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: "An unexpected error occurred",
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
    },
  };
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
};