import pino, { type LoggerOptions } from "pino";
import { pinoHttp } from "pino-http";
import type { Request, Response } from "express";

import { env } from "../config/env.js";


/** Express Request augmented with SynthView-specific context fields. */
type SynthViewRequest = Request & {
  /** Unique request identifier. */
  id?: string;
  /** Authenticated user ID, if any. */
  userId?: string;
  /** Authenticated user role, if any. */
  role?: string;
  /** Authentication method used, if any. */
  authMethod?: string;
  /** Resource type being accessed, if any. */
  resource?: string;
  /** Resource ID being accessed, if any. */
  resourceId?: string;
  /** Action being performed, if any. */
  action?: string;
  /** Interview ID, if this request relates to an interview. */
  interviewId?: string;
  /** Interview state, if applicable. */
  interviewState?: string;
  /** Interview type, if applicable. */
  interviewType?: string;
};

/**
 * Safely extract the route path from an Express request.
 * req.route is set at runtime by Express 5 but is not in @types/express.
 */
function getRoutePath(req: Request): string | undefined {
  const route = (req as { route?: { path?: string } }).route;
  return route?.path;
}


const options: LoggerOptions = {
  level: env.LOG_LEVEL,

  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        },
      }
    : {}),

  // Applies to BOTH dev and production
  redact: {
    paths: [
      // HTTP headers
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",

      // Credentials / tokens
      "req.body.password",
      "req.body.currentPassword",
      "req.body.newPassword",
      "req.body.passwordConfirmation",
      "req.body.secret",
      "req.body.apiKey",
      "req.body.clientSecret",
      "req.body.privateKey",
      "req.body.token",
      "req.body.accessToken",
      "req.body.refreshToken",
      "req.body.sessionToken",
      "req.body.csrfToken",
      "req.body.verificationToken",
      "req.body.resetToken",
      "req.body.otp",
    ],
    censor: "[REDACTED]",
  },
};


export const logger = pino(options);


/**
 * Express middleware that adds structured request logging.
 *
 * Logs useful metadata without dumping sensitive data:
 * - requestId (if present)
 * - method, path, route
 * - statusCode, responseTime
 * - authenticated user context (if available)
 * - resource/action context (if available)
 *
 * Never logs:
 * - request/response bodies
 * - interview answers
 * - candidate code
 * - AI prompts/responses
 * - tokens/credentials
 */
export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    const expressRes = res as Response;
    if (err || expressRes.statusCode >= 500) return "error";
    if (expressRes.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    const expressReq = req as SynthViewRequest;
    const expressRes = res as Response;
    const route = getRoutePath(expressReq) ?? "(no route)";
    return `${expressReq.method} ${route} → ${expressRes.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    const expressReq = req as SynthViewRequest;
    const expressRes = res as Response;
    const route = getRoutePath(expressReq) ?? "(no route)";
    return `${expressReq.method} ${route} → ${expressRes.statusCode} (${err.name}: ${err.message})`;
  },
  customProps: (req, res) => {
    const expressReq = req as SynthViewRequest;
    const expressRes = res as Response;
    const props: Record<string, unknown> = {
      requestId: expressReq.id,
      method: expressReq.method,
      path: expressReq.path,
      route: getRoutePath(expressReq),
      statusCode: expressRes.statusCode,
      httpVersion: expressReq.httpVersion,
      userAgent: expressReq.headers["user-agent"],
      ip: expressReq.ip,
      contentLength: expressReq.headers["content-length"],
      referer: expressReq.headers.referer,
      origin: expressReq.headers.origin,
    };

    // Add authenticated context if available
    if (expressReq.userId) {
      props.authenticated = true;
      props.userId = expressReq.userId;
      props.role = expressReq.role;
      props.authMethod = expressReq.authMethod;
    }

    // Add resource/action context if available
    if (expressReq.resource) {
      props.resource = expressReq.resource;
      props.resourceId = expressReq.resourceId;
      props.action = expressReq.action;
    }

    // Add interview context if available
    if (expressReq.interviewId) {
      props.interviewId = expressReq.interviewId;
      props.interviewState = expressReq.interviewState;
      props.interviewType = expressReq.interviewType;
    }

    return props;
  },
  // Do NOT log request/response bodies or the raw req/res objects — SynthView
  // handles sensitive data (interview answers, code, AI I/O). Curated fields
  // come from customProps above. `req`/`res` serializers drop the objects
  // entirely so headers/params are never captured. Redaction remains as a
  // safety net for any other logger call that passes req/res-shaped objects.
  serializers: {
    req: () => undefined,
    res: () => undefined,
    err: pino.stdSerializers.err,
  },
});