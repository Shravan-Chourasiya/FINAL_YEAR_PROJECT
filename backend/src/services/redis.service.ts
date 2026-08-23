import bcrypt from "bcrypt";
import { redisClient } from "../config/redis.init.js";

interface PendingOTP {
  otpHash: string;
  email: string;
  userId: string | undefined;
  purpose: string;
  newValue: string | undefined;
  attemptsLeft: number;
  failedAttempts: number;
  createdAt: number;
  expiresAt: number;
}

export const otpService = {
  async storeOTP(
    email: string,
    otp: string,
    purpose: string,
    userId?: string,
    newValue?: string,
    ttl: number = 600,
    keyPrefix: string = "otp:",
  ): Promise<{ success: boolean; message?: string }> {
    const otpExists = await this.otpExists(email, purpose, keyPrefix);
    if (otpExists) {
      await this.invalidateOTP(email, purpose, keyPrefix);
    }

    const otpHash = await bcrypt.hash(otp, 12);
    const key = `${keyPrefix}${email.toLowerCase()}:${purpose}`;

    const data: PendingOTP = {
      otpHash,
      email: email.toLowerCase(),
      userId,
      purpose,
      newValue,
      attemptsLeft: 5,
      failedAttempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
    };

    await redisClient.setex(key, ttl, JSON.stringify(data));
    return { success: true };
  },

  async verifyOTP(
    email: string,
    otp: string,
    purpose: string,
    keyPrefix: string = "otp:",
  ): Promise<{ success: boolean; message: string; userId?: string; newValue?: string }> {
    const key = `${keyPrefix}${email.toLowerCase()}:${purpose}`;
    const rawData = await redisClient.get(key);

    if (!rawData) {
      return { success: false, message: "OTP not found or expired" };
    }

    let otpData: PendingOTP;
    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      if (
        typeof parsed.otpHash !== "string" ||
        typeof parsed.attemptsLeft !== "number" ||
        typeof parsed.failedAttempts !== "number" ||
        typeof parsed.expiresAt !== "number" ||
        typeof parsed.createdAt !== "number"
      ) {
        await redisClient.del(key);
        return { success: false, message: "OTP data corrupted" };
      }
      otpData = parsed as unknown as PendingOTP;
    } catch {
      await redisClient.del(key);
      return { success: false, message: "OTP data corrupted" };
    }

    // Check if rate limited — 3+ failed attempts within the OTP window
    if (otpData.failedAttempts >= 3) {
      const timeSinceCreation = Date.now() - otpData.createdAt;
      if (timeSinceCreation < 60_000) {
        return { success: false, message: "Too many failed attempts. Please try again later." };
      }
    }

    if (otpData.attemptsLeft <= 0) {
      await redisClient.del(key);
      return { success: false, message: "Maximum attempts exceeded" };
    }

    const isValid = await bcrypt.compare(otp, otpData.otpHash);

    if (!isValid) {
      otpData.attemptsLeft -= 1;
      otpData.failedAttempts += 1;

      if (otpData.attemptsLeft <= 0) {
        await redisClient.del(key);
        return { success: false, message: "Maximum attempts exceeded" };
      }

      // Guard against negative TTL on race condition
      const remainingTTL = Math.max(1, Math.floor((otpData.expiresAt - Date.now()) / 1000));
      await redisClient.setex(key, remainingTTL, JSON.stringify(otpData));

      return { success: false, message: `Invalid OTP. ${otpData.attemptsLeft} attempts remaining.` };
    }

    await redisClient.del(key);

    return {
      success: true,
      message: "OTP verified successfully",
      ...(otpData.userId && { userId: otpData.userId }),
      newValue: otpData.newValue ?? "",
    };
  },

  async otpExists(email: string, purpose: string, keyPrefix: string = "otp:"): Promise<boolean> {
    const key = `${keyPrefix}${email.toLowerCase()}:${purpose}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
  },

  async getRemainingAttempts(email: string, purpose: string, keyPrefix: string = "otp:"): Promise<number | null> {
    const key = `${keyPrefix}${email.toLowerCase()}:${purpose}`;
    const data = await redisClient.get(key);
    if (!data) return null;
    const otpData = JSON.parse(data) as PendingOTP;
    return otpData.attemptsLeft;
  },

  async invalidateOTP(email: string, purpose: string, keyPrefix: string = "otp:"): Promise<void> {
    const key = `${keyPrefix}${email.toLowerCase()}:${purpose}`;
    await redisClient.del(key);
  },

  async getOTPData(email: string, purpose: string, keyPrefix: string = "otp:"): Promise<PendingOTP | null> {
    const key = `${keyPrefix}${email.toLowerCase()}:${purpose}`;
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as PendingOTP;
  },
};
