import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import { ErrorCodes } from "../src/constants/errorCodes.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
  default: vi.fn(),
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
  default: { compare: vi.fn(), hash: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { deleteAccountService } from "../src/modules/auth/services/auth.service.js";
import { getPgDb } from "../src/db/postgres.init.js";
import { blacklistToken } from "../src/utils/token.util.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const activeUser = { id: "user-uuid", accountStatus: "active" };

function mockDb(userResult: unknown[] = [activeUser]) {
  const updateChain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };

  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(userResult),
      }),
    }),
  });

  const update = vi.fn().mockReturnValue(updateChain);

  vi.mocked(getPgDb).mockReturnValue({ select, update } as never);
  return { select, update, updateChain };
}

// ── deleteAccountService ──────────────────────────────────────────────────────

describe("deleteAccountService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without error on successful account deletion", async () => {
    mockDb();

    await expect(deleteAccountService("user-uuid", "access-token", "refresh-token")).resolves.toBeUndefined();
  });

  it("sets accountStatus to disabled with disabledAt and scheduledDeletionAt", async () => {
    const { updateChain } = mockDb();

    await deleteAccountService("user-uuid", "access-token", "refresh-token");

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        accountStatus: "disabled",
        disabledAt: expect.any(Date),
        scheduledDeletionAt: expect.any(Date),
      }),
    );
  });

  it("schedules deletion 30 days from now", async () => {
    const { updateChain } = mockDb();
    const before = Date.now();

    await deleteAccountService("user-uuid", "access-token", "refresh-token");

    const after = Date.now();
    const call = vi.mocked(updateChain.set).mock.calls.find(
      ([arg]) => (arg as Record<string, unknown>).accountStatus === "disabled",
    );
    const scheduledDeletionAt = (call?.[0] as Record<string, unknown>).scheduledDeletionAt as Date;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(scheduledDeletionAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs);
    expect(scheduledDeletionAt.getTime()).toBeLessThanOrEqual(after + thirtyDaysMs);
  });

  it("revokes all active sessions for the user", async () => {
    const { updateChain } = mockDb();

    await deleteAccountService("user-uuid", "access-token", "refresh-token");

    expect(updateChain.set).toHaveBeenCalledWith({ isActive: false, isRevoked: true });
  });

  it("blacklists both access and refresh tokens", async () => {
    mockDb();

    await deleteAccountService("user-uuid", "access-token", "refresh-token");

    expect(blacklistToken).toHaveBeenCalledWith("access-token");
    expect(blacklistToken).toHaveBeenCalledWith("refresh-token");
    expect(blacklistToken).toHaveBeenCalledTimes(2);
  });

  it("throws RESOURCE_NOT_FOUND when user does not exist", async () => {
    mockDb([]);

    await expect(deleteAccountService("nonexistent-uuid", "access-token", "refresh-token")).rejects.toMatchObject({
      statusCode: StatusCodes.NOT_FOUND,
      errorCode: ErrorCodes.RESOURCE_NOT_FOUND,
    });
  });

  it("does not update DB or blacklist tokens when user is not found", async () => {
    const { update } = mockDb([]);

    await expect(deleteAccountService("nonexistent-uuid", "access-token", "refresh-token")).rejects.toThrow();

    expect(update).not.toHaveBeenCalled();
    expect(blacklistToken).not.toHaveBeenCalled();
  });
});
