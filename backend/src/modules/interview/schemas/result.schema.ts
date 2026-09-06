import { pgTable, uuid, numeric, integer, text, timestamp } from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { interviewsTable } from "./interview.schema.js";

export const interviewResultsTable = pgTable("interview_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }).notNull(),
  technicalScore: numeric("technical_score", { precision: 5, scale: 2 }).notNull(),
  communicationScore: numeric("communication_score", { precision: 5, scale: 2 }).notNull(),
  problemSolvingScore: numeric("problem_solving_score", { precision: 5, scale: 2 }).notNull(),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull(),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  questionsSkipped: integer("questions_skipped").notNull().default(0),
  questionsEvaluated: integer("questions_evaluated").notNull().default(0),
  totalDuration: integer("total_duration").notNull(),
  feedback: text("feedback").notNull(),
  strengths: text("strengths").array().notNull(),
  weaknesses: text("weaknesses").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(dbNow),
});
