import crypto from "crypto";

export function generateCsrfToken(): string {
  const token = crypto.randomBytes(64).toString("hex");
  return token;
}
