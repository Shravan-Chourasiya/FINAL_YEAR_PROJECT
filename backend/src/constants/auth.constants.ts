// ── Bcrypt ────────────────────────────────────────────────────────────────────
export const SALT_ROUNDS = 12;

// ── OTP Purposes ──────────────────────────────────────────────────────────────
export const OTP_PURPOSE = {
  REGISTER: "registration",
  FORGOT_PASSWORD: "forgot_password",
  RECOVER_ACCOUNT: "recover_account",
} as const;

// ── Session ───────────────────────────────────────────────────────────────────
export const MAX_SESSIONS = 5;
export const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ACCOUNT_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── JWT ───────────────────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "30d";
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

// ── Cookie Names ──────────────────────────────────────────────────────────────
export const COOKIE_NAMES = {
  ACCESS: "access_token",
  REFRESH: "refresh_token",
  DEVICE_ID: "device_id",
} as const;

// ── Cookie Max Ages (ms) ──────────────────────────────────────────────────────
export const COOKIE_MAX_AGE = {
  ACCESS: 15 * 60 * 1000,           // 15 minutes
  REFRESH: 30 * 24 * 60 * 60 * 1000, // 30 days
  DEVICE_ID: 365 * 24 * 60 * 60 * 1000, // 1 year
} as const;
