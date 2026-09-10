import { parse as parseCookies } from "cookie";
import type { IoServer } from "./socket.types.js";
import { verifyToken, isTokenBlacklisted, COOKIE_NAMES } from "../utils/token.util.js";
import { logger } from "../utils/logger.js";

export function registerSocketAuth(io: IoServer): void {
  // io.use expects (socket, next) => void — wrap the async logic explicitly
  io.use((socket, next) => {
    void (async () => {
      try {
        const rawCookies = socket.handshake.headers.cookie ?? "";
        const cookies = parseCookies(rawCookies);
        const token = cookies[COOKIE_NAMES.ACCESS];

        if (!token) {
          return next(new Error("AUTH_UNAUTHORIZED: access token cookie missing"));
        }

        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) {
          return next(new Error("AUTH_SESSION_EXPIRED: session has been revoked"));
        }

        const payload = verifyToken(token);

        if (payload.type !== "access") {
          return next(new Error("AUTH_UNAUTHORIZED: invalid token type"));
        }

        // Attach auth data to the socket — available in all event handlers
        socket.data.userId = payload.userId;
        socket.data.sessionId = payload.sessionId;

        logger.debug({ userId: payload.userId, socketId: socket.id }, "[ws] socket authenticated");
        next();
      } catch {
        next(new Error("AUTH_SESSION_EXPIRED: invalid or expired token"));
      }
    })();
  });
}
