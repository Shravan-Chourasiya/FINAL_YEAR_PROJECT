/**
 * Standard response envelope used by every API endpoint.
 *
 * This contract is intentionally strict and predictable:
 * - Every response has `status`, `statusCode`, and `message`.
 * - Success responses carry `data`.
 * - Error responses carry `error` with a stable `code` and optional `details`.
 *
 * Clients can safely branch on `status` and `error.code`.
 */

/**
 * Base shape shared by both success and error responses.
 *
 * `status` is a discriminator: use `status === "success"` or
 * `status === "error"` to narrow the type.
 */
export interface StandardResponse {
  status: "success" | "error";
  statusCode: number;
  message: string;
}

/**
 * Success response envelope.
 *
 * `data` is generic so callers can specify the exact payload type:
 *
 *   SuccessResponse<{ id: string; name: string }>
 *
 * Defaults to `unknown` to force consumers to handle the payload explicitly.
 */
export interface SuccessResponse<T = unknown> extends StandardResponse {
  status: "success";
  data: T;
}

/**
 * Error response envelope.
 *
 * `error.code` is a stable machine-readable identifier (e.g.
 * `AUTH_INVALID_CREDENTIALS`). Clients may branch on it.
 *
 * `error.details` is optional and carries additional context such as
 * validation field errors. It is intentionally `unknown` to discourage
 * direct access without type guards.
 */
export interface ErrorResponse extends StandardResponse {
  status: "error";
  error: {
    code: string;
    details?: unknown;
  };
}

/**
 * Union of all possible response shapes.
 *
 * Useful for type guards:
 *
 *   const response: ApiResponse<{ id: string }> = ...;
 *   if (response.status === "success") {
 *     // response.data is { id: string }
 *   }
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
