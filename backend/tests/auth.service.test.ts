import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../src/utils/appError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../src/services/redis.service.js", () => ({
  otpService: {
    storeOTP: vi.fn().mockResolvedValue({ success: true }),
    verifyOTP: vi.fn(),
  },
}));

vi.mock("../src/services/nodemailer.service.js", () => ({
  sendOtpMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
}));

vi.mock("../src/utils/email.js", () => ({
  getRandomOtp: vi.fn().mockReturnValue("123456"),
  getEmailTemplate: vi.fn(),
  handlerNodeMailerError: vi.fn(),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { registerUserService, verifyOtpService } from "../src/modules/auth/services/auth.service.js";
import { otpService } from "../src/services/redis.service.js";
import { sendOtpMail } from "../src/services/nodemailer.service.js";
import { getPgDb } from "../src/db/postgres.init.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockDb(overrides: { selectResult?: unknown[]; insertResult?: unknown } = {}) {
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(overrides.insertResult ?? []),
  });
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(overrides.selectResult ?? []),
      }),
    }),
  });
  vi.mocked(getPgDb).mockReturnValue({ select, insert } as never);
  return { select, insert };
}

const validRegisterInput = {
  email: "user@example.com",
  password: "Password1",
  username: "john_doe",
};

const validVerifyInput = {
  email: "user@example.com",
  otp: "123456",
};

// ── registerUserService ───────────────────────────────────────────────────────

describe("registerUserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores OTP in Redis and sends email for new user", async () => {
    mockDb({ selectResult: [] });

    await registerUserService(validRegisterInput);

    expect(otpService.storeOTP).toHaveBeenCalledWith(
      validRegisterInput.email,
      "123456",
      "registration",
      undefined,
      expect.stringContaining(validRegisterInput.username),
    );
    expect(sendOtpMail).toHaveBeenCalledWith(validRegisterInput.email, "123456");
  });

  it("throws RESOURCE_ALREADY_EXISTS if email is taken", async () => {
    mockDb({ selectResult: [{ id: "existing-uuid" }] });

    await expect(registerUserService(validRegisterInput)).rejects.toMatchObject({
      errorCode: ErrorCodes.RESOURCE_ALREADY_EXISTS,
      statusCode: StatusCodes.CONFLICT,
    });
  });

  it("does not send email if user already exists", async () => {
    mockDb({ selectResult: [{ id: "existing-uuid" }] });

    await expect(registerUserService(validRegisterInput)).rejects.toThrow(AppError);
    expect(sendOtpMail).not.toHaveBeenCalled();
  });

  it("stores registration data as JSON in newValue", async () => {
    mockDb({ selectResult: [] });

    await registerUserService({ ...validRegisterInput, firstName: "John" });

    const storeCall = vi.mocked(otpService.storeOTP).mock.calls[0];
    const newValue = JSON.parse(storeCall?.[4] ?? "{}") as Record<string, unknown>;
    expect(newValue.username).toBe(validRegisterInput.username);
    expect(newValue.firstName).toBe("John");
  });
});

// ── verifyOtpService ──────────────────────────────────────────────────────────

describe("verifyOtpService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts user into DB on successful OTP verification", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({
      success: true,
      message: "OTP verified successfully",
      newValue: JSON.stringify({ username: "john_doe", password: "Password1" }),
    });
    const { insert } = mockDb();

    await verifyOtpService(validVerifyInput);

    expect(insert).toHaveBeenCalled();
  });

  it("throws AUTH_INVALID_CREDENTIALS for wrong OTP", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({
      success: false,
      message: "Invalid OTP. 4 attempts remaining.",
    });
    mockDb();

    await expect(verifyOtpService(validVerifyInput)).rejects.toMatchObject({
      errorCode: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  });

  it("throws RATE_LIMIT_EXCEEDED for too many failed attempts", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({
      success: false,
      message: "Too many failed attempts. Please try again later.",
    });
    mockDb();

    await expect(verifyOtpService(validVerifyInput)).rejects.toMatchObject({
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
    });
  });

  it("throws RATE_LIMIT_EXCEEDED for maximum attempts exceeded", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({
      success: false,
      message: "Maximum attempts exceeded",
    });
    mockDb();

    await expect(verifyOtpService(validVerifyInput)).rejects.toMatchObject({
      errorCode: ErrorCodes.RATE_LIMIT_EXCEEDED,
      statusCode: StatusCodes.TOO_MANY_REQUESTS,
    });
  });

  it("throws VALIDATION_FAILED when newValue is missing", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({
      success: true,
      message: "OTP verified successfully",
      newValue: "",
    });
    mockDb();

    await expect(verifyOtpService(validVerifyInput)).rejects.toMatchObject({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
    });
  });

  it("does not insert user if OTP verification fails", async () => {
    vi.mocked(otpService.verifyOTP).mockResolvedValue({
      success: false,
      message: "OTP not found or expired",
    });
    const { insert } = mockDb();

    await expect(verifyOtpService(validVerifyInput)).rejects.toThrow(AppError);
    expect(insert).not.toHaveBeenCalled();
  });
});
