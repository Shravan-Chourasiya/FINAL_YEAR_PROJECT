import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { redisClient } from "../config/redis.init.js";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, REFRESH_TOKEN_TTL_SECONDS } from "../constants/auth.constants.js";
export {

  COOKIE_NAMES,
} from "../constants/auth.constants.js";

export interface TokenPayload {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  type: "access" | "refresh";
}

export function signAccessToken(payload: Omit<TokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(payload: Omit<TokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export async function blacklistToken(token: string): Promise<void> {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : REFRESH_TOKEN_TTL_SECONDS;
  if (ttl > 0) {
    await redisClient.setex(`bl:${token}`, ttl, "1");
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redisClient.exists(`bl:${token}`);
  return result === 1;
}
