import * as z from "zod";
import { userRegex } from "../../../lib/zod/user.zschema.js";

export const registerSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  password: z.string().regex(userRegex.passwordRegex, {
    message: "Password must be at least 8 characters long and contain at least one letter and one number",
  }),
  username: z.string().regex(userRegex.usernameRegex, {
    message: "Username must be 3-30 characters long and can only contain letters, numbers, and underscores",
  }),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  otp: z.string().length(6, { message: "OTP must be exactly 6 digits" }).regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
});

export const loginSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  password: z.string().min(1, { message: "Password is required" }),
  deviceType: z.enum(["desktop", "mobile", "tablet"]).default("desktop"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
});

export const forgotPasswordOtpVerifySchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  otp: z.string().length(6, { message: "OTP must be exactly 6 digits" }).regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
  newPassword: z.string().regex(userRegex.passwordRegex, {
    message: "Password must be at least 8 characters long and contain at least one letter and one number",
  }),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const recoverAccountOtpSchema = z.object({
  email: z.string().regex(userRegex.emailRegex, { message: "Invalid email format" }),
  otp: z.string().length(6, { message: "OTP must be exactly 6 digits" }).regex(/^\d{6}$/, { message: "OTP must contain only digits" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ForgotPasswordOtpVerifyInput = z.infer<typeof forgotPasswordOtpVerifySchema>;
export type RecoverAccountOtpInput = z.infer<typeof recoverAccountOtpSchema>;
