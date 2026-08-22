import { pgTable, uuid, integer, boolean, pgEnum, varchar, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./user.schema.js";
import { dbNow } from "../../../utils/db.util.js";

export const deviceTypeEnum = pgEnum("device_type", ["desktop", "mobile", "tablet"]);

export const sessionsTable = pgTable("sessions", {
  // Base fields
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

  // Account fields
  activeSessionCount: integer("active_session_count").notNull().default(1),
  totalSessionCount: integer("total_session_count").notNull().default(1),

  // Token fields
  tokenFamily: uuid("token_family").notNull(),
  refreshToken: varchar("refresh_token", { length: 512 }).notNull(),
  accessToken: varchar("access_token", { length: 512 }).notNull(),

  // Status fields
  isActive: boolean("is_active").notNull().default(true),
  isRevoked: boolean("is_revoked").notNull().default(false),

  // MetaData fields
  loginCount: integer("login_count").notNull().default(1),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),

  // Expiration fields
  isExpired: boolean("is_expired").notNull().default(false),
  expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),

  // Device fields
  deviceType: deviceTypeEnum("device_type").notNull().default("desktop"),
  deviceId: uuid("device_id").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: varchar("user_agent", { length: 512 }).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(dbNow),
});
