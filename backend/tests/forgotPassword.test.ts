import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
}));

vi.mock("../src/services/redis.service.js", () => ({
  otpService: {
    storeOTP: vi.fn().mockResolvedValue({ success: true }),
    verifyOTP: vi.fn(),
  },
}));

vi.mock("../src/services/nodemailer.service.js", () => ({
  sendOtpMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/utils/email.js", () => ({
  getRandomOtp: vi.fn().mockReturnValue("123456"),
}));

vi.mock("../src/utils/token.util.js", () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  blacklistToken: vi.fn().mockResolvedValue(undefined),
  isTokenBlacklisted: vi.fn(),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("new-hashed-password"),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { forgotPasswordService, forgotPasswordOtpVerifyService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import { otpService } from "../src/services/redis.service.js";
import { sendOtpMail } from "../src/services/nodemailer.service.js";
import { blacklistToken } from "../src/utils/token.util.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeUser = { id: "user-uuid", accountStatus: "active" };

type DbMockOptions = {
  userResult?: unknown[];
  sessionResult?: unknown[];
};

function mockDb({ userResult = [activeUser], sessionResult = [] }: DbMockOptions = {}) {
  let selectCallCount = 0;

  const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };

  const select = vi.fn().mockImplementation(() => {
    selectCallCount++;
    const isFirstSelect = selectCallCount === 1;
    const result = isFirstSelect ? userResult : sessionResult;

    if (isFirstSelect) {
      // User lookup: .select().from().where().limit()
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
      };
    } else {
      // Sessions lookup: .select().from().where() — awaited directly, no .limit()
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(result),
        }),
      };
    }
  });

  const update = vi.fn().mockReturnValue(updateChain);

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update, updateChain };
}

// ── forgotPasswordService ─────────────────────────────────────────────────────

describe("forgotPasswordService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores OTP and sends email for an active account", async () => {
    mockDb();

    await forgotPasswordService({ email: "user@example.com" });

    expect(otpService.storeOTP).toHaveBeenCalledWith("user@example.com", "123456", "forgot_password", "user-uuid");
    expect(sendOtpMail).toHaveBeenCalledWith("user@example.com", "123456");
  });

  it("resolves silently when user does not exist", async () => {
    mockDb({ userResult: [] });

    await expect(forgotPasswordService({ email: "ghost@example.com" })).resolves.toBeUndefined();
    expect(otpService.storeOTP).not.toHaveBeenCalled();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });

  it("resolves silently when account is disabled", async () => {
    mockDb({ userResult: [{ id: "user-uuid", accountStatus: "disabled" }] });

    await expect(forgotPasswordService({ email: "user@example.com" })).resolves.toBeUndefined();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });

  it("resolves silently when account is suspended", async () => {
    mockDb({ userResult: [{ id: "user-uuid", accountStatus: "suspended" }] });

    await expect(forgotPasswordService({ email: "user@example.com" })).resolves.toBeUndefined();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });
});

// ── forgotPasswordOtpVerifyService ────────────────────────────────────────────

describe("forgotPasswordOtpVerifyService", () => {
  const validInput = { email: "user@example.com", otp: "123456", newPassword: "NewPass1", confirmPassword: "NewPass1" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates password and invalidates all active sessions on success", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: true, message: "OTP verified", userId: "user-uuid" });
    const activeSessions = [
      { accessToken: "access-1", refreshToken: "refresh-1" },
      { accessToken: "access-2", refreshToken: "refresh-2" },
    ];
    const { updateChain } = mockDb({ sessionResult: activeSessions });

    await forgotPasswordOtpVerifyService(validInput);

    expect(updateChain.set).toHaveBeenCalledWith({ password: "new-hashed-password" });
    expect(updateChain.set).toHaveBeenCalledWith({ isActive: false, isRevoked: true });
  });

  it("blacklists all active session tokens on success", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: true, message: "OTP verified", userId: "user-uuid" });
    const activeSessions = [
      { accessToken: "access-1", refreshToken: "refresh-1" },
      { accessToken: "access-2", refreshToken: "refresh-2" },
    ];
    mockDb({ sessionResult: activeSessions });

    await forgotPasswordOtpVerifyService(validInput);

    expect(blacklistToken).toHaveBeenCalledWith("access-1");
    expect(blacklistToken).toHaveBeenCalledWith("refresh-1");
    expect(blacklistToken).toHaveBeenCalledWith("access-2");
    expect(blacklistToken).toHaveBeenCalledWith("refresh-2");
    expect(blacklistToken).toHaveBeenCalledTimes(4);
  });

  it("resolves without error when no active sessions exist", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: true, message: "OTP verified", userId: "user-uuid" });
    mockDb({ sessionResult: [] });

    await expect(forgotPasswordOtpVerifyService(validInput)).resolves.toBeUndefined();
    expect(blacklistToken).not.toHaveBeenCalled();
  });

  it("throws AUTH_INVALID_CREDENTIALS for wrong OTP", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Invalid OTP. 4 attempts remaining." });
    mockDb();

    await expect(forgotPasswordOtpVerifyService(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it("throws RATE_LIMIT_EXCEEDED when too many attempts", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Too many failed attempts. Please try again later." });
    mockDb();

    await expect(forgotPasswordOtpVerifyService(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    });
  });

  it("throws RATE_LIMIT_EXCEEDED when maximum attempts exceeded", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Maximum attempts exceeded" });
    mockDb();

    await expect(forgotPasswordOtpVerifyService(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    });
  });

  it("does not update DB or blacklist tokens when OTP verification fails", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Invalid OTP." });
    const { update } = mockDb();

    await expect(forgotPasswordOtpVerifyService(validInput)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(blacklistToken).not.toHaveBeenCalled();
  });
});
