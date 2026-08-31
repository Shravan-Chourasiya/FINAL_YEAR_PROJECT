import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../src/utils/appError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
}));

vi.mock("../src/utils/token.util.js", () => ({
  signAccessToken: vi.fn().mockReturnValue("mock-access-token"),
  signRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { loginService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import bcrypt from "bcrypt";

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeUser = {
  id: "user-uuid",
  email: "user@example.com",
  password: "hashed-password",
  isVerified: true,
  accountStatus: "active",
  sessionCount: 0,
};

const loginInput = {
  email: "user@example.com",
  password: "Password1",
  deviceType: "desktop" as const,
};

type DbMockOptions = {
  userResult?: unknown[];
  sessionResult?: unknown[];
  insertResult?: unknown[];
};

function mockDb({ userResult = [activeUser], sessionResult = [], insertResult = [{ id: "session-uuid" }] }: DbMockOptions = {}) {
  let selectCallCount = 0;

  const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };

  const select = vi.fn().mockImplementation(() => {
    selectCallCount++;
    const result = selectCallCount === 1 ? userResult : sessionResult;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    };
  });

  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(insertResult),
    }),
  });

  const update = vi.fn().mockReturnValue(updateChain);

  vi.mocked(getPgDb).mockReturnValue({ select, insert, update } as never);
  return { select, insert, update };
}

// ── loginService ──────────────────────────────────────────────────────────────

describe("loginService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tokens and deviceId on successful login", async () => {
    mockDb();
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await loginService(loginInput, "127.0.0.1", "Mozilla/5.0");

    expect(result).toMatchObject({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      deviceId: expect.any(String),
      sessionId: "session-uuid",
    });
  });

  it("reuses existingDeviceId when provided", async () => {
    mockDb();
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await loginService(loginInput, "127.0.0.1", "Mozilla/5.0", "existing-device-id");

    expect(result.deviceId).toBe("existing-device-id");
  });

  it("throws AUTH_INVALID_CREDENTIALS when user not found", async () => {
    mockDb({ userResult: [] });

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it("throws AUTH_FORBIDDEN when email is not verified", async () => {
    mockDb({ userResult: [{ ...activeUser, isVerified: false }] });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.FORBIDDEN,
      errorCode: ErrorCodes.AUTH_FORBIDDEN,
    });
  });

  it("throws AUTH_FORBIDDEN when account is disabled", async () => {
    mockDb({ userResult: [{ ...activeUser, accountStatus: "disabled" }] });

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.FORBIDDEN,
      errorCode: ErrorCodes.AUTH_FORBIDDEN,
    });
  });

  it("throws AUTH_FORBIDDEN when account is suspended", async () => {
    mockDb({ userResult: [{ ...activeUser, accountStatus: "suspended" }] });

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.FORBIDDEN,
      errorCode: ErrorCodes.AUTH_FORBIDDEN,
    });
  });

  it("throws AUTH_INVALID_CREDENTIALS on wrong password", async () => {
    mockDb();
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it("throws RESOURCE_CONFLICT when max sessions reached", async () => {
    const maxSessions = Array.from({ length: 5 }, (_, i) => ({ id: `session-${i}` }));
    mockDb({ sessionResult: maxSessions });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.CONFLICT,
      errorCode: ErrorCodes.RESOURCE_CONFLICT,
    });
  });

  it("throws INTERNAL_SERVER_ERROR when session insert fails", async () => {
    mockDb({ insertResult: [] });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await expect(loginService(loginInput, "127.0.0.1", "Mozilla/5.0")).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  });
});

// ── loginController ───────────────────────────────────────────────────────────

vi.mock("../src/modules/auth/services/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/modules/auth/services/auth.service.js")>();
  return { ...actual, loginService: vi.fn() };
});

import { loginController } from "../src/modules/auth/controllers/auth.controller.js";
import { loginService as loginServiceMock } from "../src/modules/auth/services/auth.service.js";

function mockReqRes(overrides: { cookies?: Record<string, string>; body?: object; headers?: Record<string, string> } = {}) {
  const req = {
    body: overrides.body ?? loginInput,
    cookies: overrides.cookies ?? {},
    headers: overrides.headers ?? { "user-agent": "Mozilla/5.0" },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe("loginController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds 200 and sets cookies on successful login", async () => {
    vi.mocked(loginServiceMock).mockResolvedValue({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      deviceId: "device-uuid",
      sessionId: "session-uuid",
    });

    const { req, res, next } = mockReqRes();
    await loginController(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: "Login successful." }));
    expect(res.cookie).toHaveBeenCalledTimes(3);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes existing device_id cookie to loginService", async () => {
    vi.mocked(loginServiceMock).mockResolvedValue({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      deviceId: "existing-device-id",
      sessionId: "session-uuid",
    });

    const { req, res, next } = mockReqRes({ cookies: { device_id: "existing-device-id" } });
    await loginController(req as never, res as never, next);

    expect(loginServiceMock).toHaveBeenCalledWith(
      expect.anything(), expect.any(String), expect.any(String), "existing-device-id"
    );
  });

  it("calls next with error when loginService throws", async () => {
    const error = new AppError("Invalid email or password", StatusCodes.UNAUTHORIZED, ErrorCodes.AUTH_INVALID_CREDENTIALS, { isOperational: true });
    vi.mocked(loginServiceMock).mockRejectedValue(error);

    const { req, res, next } = mockReqRes();
    await loginController(req as never, res as never, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
