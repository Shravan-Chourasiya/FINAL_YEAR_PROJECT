import { API_BASE_URL, HTTP_BASE_URL } from "./config";
import { ENDPOINTS } from "./constants/endpoints";

export interface BackendError {
  code?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: BackendError;

  constructor(
    code: string,
    message: string,
    status = 500,
    details?: BackendError,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  retry?: boolean;
};

function readCookie(name: string): string | null {
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function isUnsafe(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function unwrap<T>(payload: unknown, response: Response): T {
  if (!response.ok) {
    const body = payload as { message?: string; error?: BackendError } | null;
    throw new ApiError(
      body?.error?.code ?? `HTTP_${response.status}`,
      body?.message ?? response.statusText,
      response.status,
      body?.error,
    );
  }
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  if (isUnsafe(method)) {
    const csrf = readCookie("csrf_token");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const response = await fetch(`${HTTP_BASE_URL}${path}`, {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "include",
    headers,
  });
  const payload = await parseResponse(response);

  if (
    response.status === 401 &&
    !retried &&
    path !== ENDPOINTS.auth.refresh &&
    (payload as { error?: BackendError } | null)?.error?.code ===
      "AUTH_SESSION_EXPIRED"
  ) {
    await request(ENDPOINTS.auth.refresh, { method: "POST" }, true);
    return request<T>(path, options, true);
  }

  return unwrap<T>(payload, response);
}

export const http = {
  request,
  get<T>(path: string) {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "POST", body });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "PUT", body });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },
};

export function logoutLocation() {
  return `${API_BASE_URL}/${ENDPOINTS.auth.logout}`;
}
