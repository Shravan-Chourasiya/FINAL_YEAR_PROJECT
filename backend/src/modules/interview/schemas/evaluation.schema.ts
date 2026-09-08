import { pgTable, uuid, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { interviewsTable } from "./interview.schema.js";
import { interviewQuestionsTable } from "./question.schema.js";
import { interviewAnswersTable } from "./answers.schema.js";

export const answerEvaluationTable = pgTable("answer_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviewsTable.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => interviewQuestionsTable.id, { onDelete: "cascade" }),
  answerId: uuid("answer_id")
    .notNull()
    .references(() => interviewAnswersTable.id, { onDelete: "cascade" }),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  correctnessScore: numeric("correctness_score", { precision: 5, scale: 2 }).notNull(),
  relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }).notNull(),
  clarityScore: numeric("clarity_score", { precision: 5, scale: 2 }).notNull(),
  depthScore: numeric("depth_score", { precision: 5, scale: 2 }).notNull(),
  feedback: text("feedback").notNull(),
  strengths: text("strengths").array().notNull(),
  weaknesses: text("weaknesses").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(dbNow),
});
