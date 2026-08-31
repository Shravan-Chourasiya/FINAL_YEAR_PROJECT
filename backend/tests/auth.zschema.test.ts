import { describe, it, expect } from "vitest";
import { registerSchema, verifyOtpSchema } from "../src/modules/auth/zodschemas/auth.zschema.js";

describe("registerSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "Password1",
    username: "john_doe",
  };

  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional firstName and lastName", () => {
    const result = registerSchema.safeParse({ ...valid, firstName: "John", lastName: "Doe" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects password without a number", () => {
    const result = registerSchema.safeParse({ ...valid, password: "PasswordOnly" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ ...valid, password: "Pass1" });
    expect(result.success).toBe(false);
  });

  it("rejects username shorter than 3 characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username longer than 30 characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = registerSchema.safeParse({ ...valid, username: "john doe!" });
    expect(result.success).toBe(false);
  });

  it("rejects firstName longer than 100 characters", () => {
    const result = registerSchema.safeParse({ ...valid, firstName: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
    expect(registerSchema.safeParse({ email: valid.email }).success).toBe(false);
  });
});

describe("verifyOtpSchema", () => {
  const valid = {
    email: "user@example.com",
    otp: "123456",
  };

  it("accepts valid input", () => {
    expect(verifyOtpSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects OTP shorter than 6 digits", () => {
    const result = verifyOtpSchema.safeParse({ ...valid, otp: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects OTP longer than 6 digits", () => {
    const result = verifyOtpSchema.safeParse({ ...valid, otp: "1234567" });
    expect(result.success).toBe(false);
  });

  it("rejects OTP with non-digit characters", () => {
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "12345a" }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "12 456" }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ ...valid, otp: "12-456" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = verifyOtpSchema.safeParse({ ...valid, email: "bad-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(verifyOtpSchema.safeParse({}).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ email: valid.email }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ otp: valid.otp }).success).toBe(false);
  });
});
