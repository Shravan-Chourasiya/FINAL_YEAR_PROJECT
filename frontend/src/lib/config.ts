// Re-exports from the canonical env module.
// Kept for backwards compatibility — prefer importing from ./env directly.
export { env, HTTP_BASE_URL } from "./env";

// Legacy named exports used by api-client.ts and other existing files
import { env } from "./env";
export const API_BASE_URL = env.apiBaseUrl;
export const API_VERSION = env.apiVersion;
export const SOCKET_URL = env.socketUrl;
