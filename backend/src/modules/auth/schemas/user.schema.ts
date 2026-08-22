import { pgTable, uuid, varchar, boolean, pgEnum, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";

export const accountStatusEnum = pgEnum("account_status", ["active", "suspended", "disabled", "deleted"]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "facebook", "github", "none"]);
export const twoFATypeEnum = pgEnum("two_fa_type", ["none", "sms", "authenticator"]);
export const twoFAStatusEnum = pgEnum("two_fa_status", ["enabled", "disabled"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["free", "premium", "enterprise"]);

export const usersTable = pgTable("users", {
  // Base fields
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  username: varchar("username", { length: 30 }).notNull().unique(),

  // Account fields
  isVerified: boolean("is_verified").notNull().default(false),
  accountStatus: accountStatusEnum("account_status").notNull().default("active"),
  oauthProvider: oauthProviderEnum("oauth_provider").notNull().default("none"),
  isOauthEnabled: boolean("is_oauth_enabled").notNull().default(false),

  // Profile fields
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  bio: varchar("bio", { length: 500 }),
  organisation: varchar("organisation", { length: 255 }),
  country: varchar("country", { length: 100 }),

  // 2FA fields
  twoFAtype: twoFATypeEnum("two_fa_type").notNull().default("none"),
  twoFAStatus: twoFAStatusEnum("two_fa_status").notNull().default("disabled"),
  twoFASecret: varchar("two_fa_secret", { length: 255 }),
  twoFARecoveryCodes: jsonb("two_fa_recovery_codes").$type<string[]>(),
  twoFAEnabledOptions: jsonb("two_fa_enabled_options").$type<{
    sms: boolean;
    authenticator: boolean;
    email: boolean;
  }>(),

  // External model counters
  interviewCount: integer("interview_count").notNull().default(0),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").notNull().default("free"),
  sessionCount: integer("session_count").notNull().default(0),

  // Account lifecycle fields
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  scheduledDeletionAt: timestamp("scheduled_deletion_at", { withTimezone: true }),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(dbNow),
});
