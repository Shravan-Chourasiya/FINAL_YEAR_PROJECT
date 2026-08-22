import * as z from "zod";
import type { SessionType } from "../../types/schemas/sessionschema.type.js";

export const sessionSchema: z.ZodType<SessionType> = z.object({
  // Session Base fields
  id: z.string().uuid({ message: "Invalid UUID format" }),
  userId: z.string().uuid({ message: "Invalid UUID format" }),

  // Session Account fields
  activeSessionCount: z
    .number()
    .int()
    .max(5, { message: "Maximum of 5 active sessions allowed" })
    .default(1),
  totalSessionCount: z
    .number()
    .int()
    .max(10, { message: "Maximum of 10 total sessions allowed" })
    .default(1),

  // Session Token fields
  tokenFamily: z.string().uuid({ message: "Invalid UUID format" }),
  refreshToken: z.string().uuid({ message: "Invalid UUID format" }),
  accessToken: z.string().uuid({ message: "Invalid UUID format" }),

  // Session Status fields
  isActive: z.boolean().default(true),
  isRevoked: z.boolean().default(false),
  isSuspended: z.boolean().default(false),

  // Session Expiration fields
  isExpired: z.boolean().default(false),
  expiryDate: z.date().default(() => new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)), // Default to 7 days from now

  // Session MetaData fields
  loginCount: z.number().int().default(1),
  failedLoginAttempts: z
    .number()
    .int()
    .max(5, { message: "Maximum of 5 failed login attempts allowed" })
    .default(0),

  // Session Device fields
  deviceType: z.enum(["desktop", "mobile", "tablet"]).default("desktop"),
  deviceId: z.string().uuid({ message: "Invalid UUID format" }),
  ipAddress: z.string({ message: "Invalid IP address format" }),
  userAgent: z.string().max(512, { message: "User agent string is too long" }),

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
