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
  blacklistToken: vi.fn(),
  isTokenBlacklisted: vi.fn(),
  verifyToken: vi.fn(),
  COOKIE_NAMES: { ACCESS: "access_token", REFRESH: "refresh_token", DEVICE_ID: "device_id" },
  COOKIE_OPTIONS: {},
}));

vi.mock("bcrypt", () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { recoverAccountService, recoverAccountOtpService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import { otpService } from "../src/services/redis.service.js";
import { sendOtpMail } from "../src/services/nodemailer.service.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const disabledUser = { id: "user-uuid", accountStatus: "disabled" };

type DbMockOptions = {
  selectResult?: unknown[];
};

function mockDb({ selectResult = [disabledUser] }: DbMockOptions = {}) {
  const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };

  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(selectResult),
      }),
    }),
  });

  const update = vi.fn().mockReturnValue(updateChain);

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update, updateChain };
}

// ── recoverAccountService ─────────────────────────────────────────────────────

describe("recoverAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores OTP and sends email for a disabled account", async () => {
    mockDb();

    await recoverAccountService("user@example.com");

    expect(otpService.storeOTP).toHaveBeenCalledWith("user@example.com", "123456", "recover_account", "user-uuid");
    expect(sendOtpMail).toHaveBeenCalledWith("user@example.com", "123456");
  });

  it("resolves silently when user does not exist", async () => {
    mockDb({ selectResult: [] });

    await expect(recoverAccountService("ghost@example.com")).resolves.toBeUndefined();
    expect(otpService.storeOTP).not.toHaveBeenCalled();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });

  it("resolves silently when account is active (not disabled)", async () => {
    mockDb({ selectResult: [{ id: "user-uuid", accountStatus: "active" }] });

    await expect(recoverAccountService("user@example.com")).resolves.toBeUndefined();
    expect(otpService.storeOTP).not.toHaveBeenCalled();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });

  it("resolves silently when account is suspended", async () => {
    mockDb({ selectResult: [{ id: "user-uuid", accountStatus: "suspended" }] });

    await expect(recoverAccountService("user@example.com")).resolves.toBeUndefined();
    expect(sendOtpMail).not.toHaveBeenCalled();
  });
});

// ── recoverAccountOtpService ──────────────────────────────────────────────────

describe("recoverAccountOtpService", () => {
  const validInput = { email: "user@example.com", otp: "123456" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reactivates account on successful OTP verification", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: true, message: "OTP verified" });
    const { updateChain } = mockDb();

    await recoverAccountOtpService(validInput);

    expect(updateChain.set).toHaveBeenCalledWith({ accountStatus: "active", disabledAt: null, scheduledDeletionAt: null });
  });

  it("resolves without error on successful OTP verification", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: true, message: "OTP verified" });
    mockDb();

    await expect(recoverAccountOtpService(validInput)).resolves.toBeUndefined();
  });

  it("throws AUTH_INVALID_CREDENTIALS for wrong OTP", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Invalid OTP. 4 attempts remaining." });
    mockDb();

    await expect(recoverAccountOtpService(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.UNAUTHORIZED,
      errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it("throws RATE_LIMIT_EXCEEDED when too many attempts", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Too many failed attempts. Please try again later." });
    mockDb();

    await expect(recoverAccountOtpService(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    });
  });

  it("throws RATE_LIMIT_EXCEEDED when maximum attempts exceeded", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Maximum attempts exceeded" });
    mockDb();

    await expect(recoverAccountOtpService(validInput)).rejects.toMatchObject({
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
    });
  });

  it("does not update DB when OTP verification fails", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({ success: false, message: "Invalid OTP." });
    const { update } = mockDb();

    await expect(recoverAccountOtpService(validInput)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
