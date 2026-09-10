// Thin fetch wrapper. Only this file may perform raw fetch calls.
// All other modules use the typed helpers exported at the bottom.

import { HTTP_BASE_URL } from "./env";
import { ENDPOINTS } from "./constants/endpoints";
import type { ErrorCode } from "./types/api";

// ── ApiError ──────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;

  constructor(code: ErrorCode | string, message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// ── Auth-expired callback ─────────────────────────────────────────────────────

type AuthExpiredCallback = () => void;
let _onAuthExpired: AuthExpiredCallback | undefined;

/** Wire this from the auth store so http.ts stays framework-agnostic. */
export function setOnAuthExpired(cb: AuthExpiredCallback): void {
  _onAuthExpired = cb;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCookie(name: string): string | null {
  const entry = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });

  if (body !== undefined) headers.set("Content-Type", "application/json");

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    const csrf = getCookie("csrf_token");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(`${HTTP_BASE_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await parseBody(res);

  // ── One-time refresh-and-retry on AUTH_SESSION_EXPIRED ────────────────────
  if (
    res.status === 401 &&
    !isRetry &&
    path !== ENDPOINTS.auth.refresh &&
    (payload as { error?: { code?: string } } | null)?.error?.code ===
      "AUTH_SESSION_EXPIRED"
  ) {
    try {
      await request<unknown>(ENDPOINTS.auth.refresh, "POST", undefined, true);
      return request<T>(path, method, body, true);
    } catch {
      _onAuthExpired?.();
      throw buildError(payload, res);
    }
  }

  if (!res.ok) throw buildError(payload, res);

  // Unwrap standard envelope { success, statusCode, message, data }
  if (
    payload !== null &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as Record<string, unknown>).success === true &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

function buildError(payload: unknown, res: Response): ApiError {
  const body = payload as
    | { message?: string; error?: { code?: string } }
    | null;
  return new ApiError(
    body?.error?.code ?? `HTTP_${res.status}`,
    body?.message ?? res.statusText,
    res.status,
  );
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export function httpGet<T>(path: string): Promise<T> {
  return request<T>(path, "GET");
}

export function httpPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, "POST", body);
}

export function httpPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, "PUT", body);
}

export function httpDelete<T>(path: string): Promise<T> {
  return request<T>(path, "DELETE");
}
