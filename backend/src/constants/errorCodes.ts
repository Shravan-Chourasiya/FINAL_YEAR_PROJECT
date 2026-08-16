/**
 * Stable machine-readable error codes.
 *
 * These codes are part of the public API contract:
 * clients may branch on them, so they are frozen once shipped.
 * Every error response carries one of these as `error.code`.
 */
export const ErrorCodes = {
  /** Route not matched by any registered handler. */
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",

  /** Resource could not be found. */
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  /** Resource already exists (e.g. duplicate unique value). */
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",

  /** Request conflicts with the current state of a resource. */
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",

  /** Request body/query failed schema validation. */
  VALIDATION_FAILED: "VALIDATION_FAILED",

  /** Authentication is required but missing/invalid credentials. */
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",

  /** Authentication is required but not provided/expired. */
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",

  /** Authenticated but lacks permission for the requested action. */
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",

  /** Authenticated session has expired. */
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",

  /** Rate limit exceeded. */
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  /** Interview session is not in the state the operation requires. */
  INTERVIEW_INVALID_STATE: "INTERVIEW_INVALID_STATE",

  /** Interview session could not be found. */
  INTERVIEW_NOT_FOUND: "INTERVIEW_NOT_FOUND",

  /** Unexpected error; message is intentionally generic. */
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];