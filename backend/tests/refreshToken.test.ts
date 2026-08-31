import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
}));

vi.mock("../src/utils/token.util.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("new-access-token"),
  signRefreshToken: vi.fn().mockReturnValue("new-refresh-token"),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { refreshTokenService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import { isTokenBlacklisted, verifyToken, blacklistToken, signAccessToken, signRefreshToken } from "../src/utils/token.util.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const validPayload = {
  userId: "user-uuid",
  sessionId: "session-uuid",
  tokenFamily: "family-uuid",
  type: "refresh" as const,
};

const activeSession = {
  id: "session-uuid",
  userId: "user-uuid",
  tokenFamily: "family-uuid",
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
  isActive: true,
  isRevoked: false,
};

function mockDb(sessionResult: unknown[] = [activeSession]) {
  const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };

  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(sessionResult),
      }),
    }),
  });

  const update = vi.fn().mockReturnValue(updateChain);

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update, updateChain };
}

// ── refreshTokenService ───────────────────────────────────────────────────────

describe("refreshTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns new access and refresh tokens on success", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue(validPayload);
    mockDb();

    const result = await refreshTokenService("valid-refresh-token");

    expect(result).toEqual({ accessToken: "new-access-token", refreshToken: "new-refresh-token" });
  });

  it("blacklists old tokens and updates session on success", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue(validPayload);
    const { updateChain } = mockDb();

    await refreshTokenService("valid-refresh-token");

    expect(blacklistToken).toHaveBeenCalledWith("valid-refresh-token");
    expect(blacklistToken).toHaveBeenCalledWith("old-access-token");
    expect(updateChain.set).toHaveBeenCalledWith({ accessToken: "new-access-token", refreshToken: "new-refresh-token" });
  });

  it("signs new tokens with correct userId, sessionId, tokenFamily", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue(validPayload);
    mockDb();

    await refreshTokenService("valid-refresh-token");

    expect(signAccessToken).toHaveBeenCalledWith({
      userId: validPayload.userId,
      sessionId: activeSession.id,
      tokenFamily: validPayload.tokenFamily,
    });
    expect(signRefreshToken).toHaveBeenCalledWith({
      userId: validPayload.userId,
      sessionId: activeSession.id,
      tokenFamily: validPayload.tokenFamily,
    });
  });

  it("throws AUTH_SESSION_EXPIRED when token is blacklisted", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(true);

    await expect(refreshTokenService("blacklisted-token")).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_SESSION_EXPIRED,
    });
  });

  it("throws AUTH_SESSION_EXPIRED when verifyToken throws", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockImplementation(() => { throw new Error("jwt expired"); });

    await expect(refreshTokenService("expired-token")).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_SESSION_EXPIRED,
    });
  });

  it("throws AUTH_UNAUTHORIZED when token type is not refresh", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue({ ...validPayload, type: "access" as never });

    await expect(refreshTokenService("access-token-used-as-refresh")).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_UNAUTHORIZED,
    });
  });

  it("throws AUTH_SESSION_EXPIRED and revokes family on session reuse detection", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue(validPayload);
    const { update, updateChain } = mockDb([]);

    await expect(refreshTokenService("reused-token")).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_SESSION_EXPIRED,
    });

    expect(update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith({ isRevoked: true, isActive: false });
  });

  it("does not blacklist tokens when session is not found", async () => {
    vi.mocked(isTokenBlacklisted).mockResolvedValue(false);
    vi.mocked(verifyToken).mockReturnValue(validPayload);
    mockDb([]);

    await expect(refreshTokenService("reused-token")).rejects.toThrow();

    expect(blacklistToken).not.toHaveBeenCalled();
  });
});
