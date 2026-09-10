// Single source of truth for all environment variables.
// Nothing else in the codebase may read import.meta.env directly.

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
const apiVersion = import.meta.env.VITE_API_VERSION as string | undefined;

if (!apiBaseUrl) {
  throw new Error(
    "[env] VITE_API_BASE_URL is required. Copy .env.example to .env and set the value.",
  );
}

export const env = Object.freeze({
  /** Base URL of the HTTP API server, no trailing slash. e.g. http://localhost:4000 */
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),

  /** Base URL for the Socket.IO connection. Defaults to apiBaseUrl if not set. */
  socketUrl: (socketUrl ?? apiBaseUrl).replace(/\/$/, ""),

  /** Socket.IO server path. */
  socketPath: (import.meta.env.VITE_SOCKET_PATH as string | undefined) ?? "/socket.io",

  /** API version segment, e.g. "api/v1". Stripped of leading/trailing slashes. */
  apiVersion: (apiVersion ?? "api/v1").replace(/^\//, "").replace(/\/$/, ""),
});

/** Full HTTP base URL including the API version prefix, e.g. http://localhost:4000/api/v1 */
export const HTTP_BASE_URL = `${env.apiBaseUrl}/${env.apiVersion}`;
