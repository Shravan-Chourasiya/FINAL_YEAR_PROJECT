import { pgTable, uuid, varchar, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { dbNow } from "../../../utils/db.util.js";
import { interviewsTable } from "./interview.schema.js";

export const questionTypeEnum = pgEnum("question_type", ["BEHAVIORAL", "TECHNICAL", "MIXED"]);
export const questionStateEnum = pgEnum("question_state", ["PENDING", "ANSWERED", "SKIPPED", "TIMED_OUT", "EVALUATED"]);
export const timeoutBehaviorEnum = pgEnum("timeout_behavior", ["AUTO_SKIP", "EMPTY_SUBMIT", "PENALISE"]);

export const interviewQuestionsTable = pgTable("interview_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id").notNull().references(() => interviewsTable.id, { onDelete: "cascade" }),
  sequenceNumber: integer("sequence_number").notNull(),
  questionTitle: varchar("question_title", { length: 255 }).notNull(),
  questionDescription: varchar("question_description", { length: 550 }),
  questionType: questionTypeEnum("question_type").notNull(),
  questionState: questionStateEnum("question_state").notNull().default("PENDING"),
  timedOutAt: timestamp("timed_out_at", { withTimezone: true }),
  timeoutBehavior: timeoutBehaviorEnum("timeout_behavior"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdateFn(dbNow),
});
