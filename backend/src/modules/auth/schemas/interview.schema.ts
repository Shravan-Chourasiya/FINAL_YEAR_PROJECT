import { pgTable, uuid, varchar, integer, boolean, pgEnum, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./user.schema.js";
import { dbNow } from "../../../utils/db.util.js";

export const interviewStatusEnum = pgEnum("interview_status", ["SCHEDULED", "COMPLETED", "CANCELLED", "INPROGRESS", "DRAFT"]);
export const interviewCompanyStyleEnum = pgEnum("interview_company_style", ["MANGOS", "FAANG", "MAANG", "STARTUP", "CUSTOM"]);
export const interviewTypeEnum = pgEnum("interview_type", ["BEHAVIORAL", "TECHNICAL", "MIXED"]);
export const interviewVerdictEnum = pgEnum("interview_verdict", ["PASS", "FAIL", "INCONCLUSIVE"]);

export const interviewsTable = pgTable("interviews", {
  // Base fields
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

  // MetaData fields
  interviewTitle: varchar("interview_title", { length: 255 }).notNull(),
  interviewDescription: varchar("interview_description", { length: 550 }),
  interviewMetaData: jsonb("interview_meta_data").$type<{
    jobRole?: string;
    jobSkills?: string[];
    interviewCompanyStyle?: "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM";
    interviewType?: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  }>().notNull(),
  interviewDuration: integer("interview_duration").notNull(),

  // Status fields
  interviewStatus: interviewStatusEnum("interview_status").notNull().default("DRAFT"),
  isInterviewScheduled: boolean("is_interview_scheduled").notNull().default(false),
  interviewScheduledDate: timestamp("interview_scheduled_date", { withTimezone: true }),

  // Outcome fields
  interviewQuestionsGeneratedCount: integer("interview_questions_generated_count"),
  interviewQuestionsAnsweredCount: integer("interview_questions_answered_count"),
  interviewOutcome: jsonb("interview_outcome").$type<{
    finalScore: number;
    finalVerdict: "PASS" | "FAIL" | "INCONCLUSIVE";
    questionWiseScore: {
      questionId: string;
      score: number;
      answerId?: string;
    }[];
    finalFeedBack: string;
    suggestedImprovements?: string;
    helpfulResources?: string;
  }>(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(dbNow),
});
