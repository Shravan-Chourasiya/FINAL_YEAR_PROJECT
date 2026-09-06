import { eq, and, desc, lt, inArray, notInArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import getPgDb from "../../../db/postgres.init.js";
import { interviewsTable, interviewStatusEnum } from "../schemas/interview.schema.js";
import { interviewAnswersTable } from "../schemas/answers.schema.js";
import { interviewQuestionsTable } from "../schemas/question.schema.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import { ABANDONMENT_THRESHOLD_MS, QUESTION_TIMEOUT_MS } from "../../../constants/interview.constants.js";
import { StatusCodes } from "http-status-codes";
import { writeInterviewContext, deleteInterviewContext } from "./interview.context.service.js";
import type { InterviewContext } from "../types/interview.context.js";

// ── State machine ─────────────────────────────────────────────────────────────

type InterviewStatus = (typeof interviewStatusEnum.enumValues)[number];

// Terminal states — no transitions allowed out of these
const TERMINAL_STATUSES: InterviewStatus[] = ["COMPLETED", "CANCELLED", "ABANDONED", "EXPIRED", "TIMED_OUT"];

// Resumable = paused by the user (SCHEDULED), not dead
const RESUMABLE_STATUSES: InterviewStatus[] = ["SCHEDULED"];

const VALID_TRANSITIONS: Record<InterviewStatus, InterviewStatus[]> = {
  DRAFT:      ["READY"],
  READY:      ["INPROGRESS", "SCHEDULED", "CANCELLED"],
  SCHEDULED:  ["INPROGRESS", "CANCELLED"],
  INPROGRESS: ["SCHEDULED", "COMPLETED", "CANCELLED", "ABANDONED", "TIMED_OUT"],
  COMPLETED:  [],
  CANCELLED:  [],
  ABANDONED:  [],
  EXPIRED:    [],
  TIMED_OUT:  [],
};

function assertValidTransition(current: InterviewStatus, next: InterviewStatus): void {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new AppError(
      `Cannot transition interview from ${current} to ${next}`,
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }
}

// ── Repository helper (used by ownership middleware) ──────────────────────────

export async function fetchInterviewById(id: string) {
  const db = getPgDb();
  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.id, id));
  return interview;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resolveInterview(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await fetchInterviewById(interviewId);
  if (!interview || interview.userId !== authreq.auth.userId) {
    throw new AppError("Interview not found", StatusCodes.NOT_FOUND, ErrorCodes.INTERVIEW_NOT_FOUND, { isOperational: true });
  }
  return interview;
}

async function transitionInterview(interviewId: string, from: InterviewStatus, to: InterviewStatus) {
  assertValidTransition(from, to);
  const db = getPgDb();
  const [updated] = await db
    .update(interviewsTable)
    .set({ interviewStatus: to, lastActivityAt: new Date() })
    .where(eq(interviewsTable.id, interviewId))
    .returning();
  return updated;
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function createInterviewService(
  authreq: AuthenticatedRequest,
  interviewData: {
    jobrole: string;
    experience: string;
    jobSkills?: string[];
    difficulty: "EASY" | "MEDIUM" | "HARD";
    interviewStyle: "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM";
    interviewType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
    duration: number;
    maxFollowUps: number;
    isScheduled: boolean;
    scheduledDate?: Date;
    targetedCompany?: string;
  },
) {
  const db = getPgDb();

  const title = `${interviewData.jobrole} — ${interviewData.interviewType} Interview`;
  const description = interviewData.targetedCompany
    ? `Targeting ${interviewData.targetedCompany} (${interviewData.experience})`
    : `${interviewData.experience} level`;

  const [interview] = await db
    .insert(interviewsTable)
    .values({
      userId: authreq.auth.userId,
      interviewTitle: title,
      interviewDescription: description,
      interviewType: interviewData.interviewType,
      interviewCompanyStyle: interviewData.interviewStyle,
      interviewDifficulty: interviewData.difficulty,
      interviewDuration: interviewData.duration,
      interviewMetaData: {
        jobRole: interviewData.jobrole,
        ...(interviewData.jobSkills?.length ? { jobSkills: interviewData.jobSkills } : {}),
        maxFollowUps: interviewData.maxFollowUps,
      },
      interviewStatus: "DRAFT",
      isInterviewScheduled: interviewData.isScheduled,
      interviewScheduledDate: interviewData.isScheduled ? interviewData.scheduledDate : null,
    })
    .returning();

  return interview;
}

export async function getAllInterviewsService(authreq: AuthenticatedRequest) {
  const db = getPgDb();
  return db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.userId, authreq.auth.userId));
}

export async function getInterviewByIdService(authreq: AuthenticatedRequest, interviewId: string) {
  const db = getPgDb();

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(and(eq(interviewsTable.id, interviewId), eq(interviewsTable.userId, authreq.auth.userId)));

  if (!interview) {
    throw new AppError("Interview not found", StatusCodes.NOT_FOUND, ErrorCodes.INTERVIEW_NOT_FOUND, { isOperational: true });
  }

  return interview;
}

export async function getResumableInterviewsService(authreq: AuthenticatedRequest) {
  const db = getPgDb();
  return db
    .select()
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.userId, authreq.auth.userId),
        inArray(interviewsTable.interviewStatus, RESUMABLE_STATUSES),
      ),
    )
    .orderBy(desc(interviewsTable.updatedAt));
}

export async function startInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  assertValidTransition(interview.interviewStatus as InterviewStatus, "INPROGRESS");

  const now = new Date();
  const meta = interview.interviewMetaData as { jobRole?: string; jobSkills?: string[]; maxFollowUps?: number };

  // ── Step 1: Build the session context ────────────────────────────────────
  const context: InterviewContext = {
    interviewId,
    candidateIdentity: {
      userId:     authreq.auth.userId,
      experience: (meta as { experience?: string }).experience ?? "unknown",
    },
    config: {
      interviewType:   interview.interviewType,
      interviewStyle:  interview.interviewCompanyStyle,
      difficulty:      interview.interviewDifficulty,
      durationMinutes: interview.interviewDuration,
      maxFollowUps:    meta.maxFollowUps ?? 3,
      ...(meta.jobRole              ? { jobRole:    meta.jobRole    } : {}),
      ...(meta.jobSkills?.length    ? { jobSkills:  meta.jobSkills  } : {}),
    },
    questionState: {
      currentIndex:   0,
      totalQuestions: null,
    },
    timerStartedAt: now.toISOString(),
    // ── Step 2: AI context stub (replaced by LangGraph handshake in Step 10) ─
    aiContext: {
      stub:     true,
      threadId: `stub-${randomUUID()}`,
    },
  };

  // ── Step 3: Persist context to Redis (atomic gate — DB untouched until this succeeds) ──
  await writeInterviewContext(context, interview.interviewDuration);

  // ── Step 4: Transition DB status — rollback Redis on failure ─────────────
  try {
    const db = getPgDb();
    const [updated] = await db
      .update(interviewsTable)
      .set({ interviewStatus: "INPROGRESS", lastActivityAt: now, interviewStartedAt: now })
      .where(eq(interviewsTable.id, interviewId))
      .returning();
    return { interview: updated, context };
  } catch (err) {
    await deleteInterviewContext(interviewId);
    throw err;
  }
}

export async function pauseInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus as InterviewStatus, "SCHEDULED");
}

export async function resumeInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus as InterviewStatus, "INPROGRESS");
}

// ── Shared skip/timeout helper ────────────────────────────────────────────────

async function skipQuestionInternal(
  db: ReturnType<typeof getPgDb>,
  interviewId: string,
  questionId: string,
  now: Date,
  state: "SKIPPED" | "TIMED_OUT",
) {
  await db
    .update(interviewQuestionsTable)
    .set({
      questionState: state,
      ...(state === "TIMED_OUT" ? { timedOutAt: now, timeoutBehavior: "AUTO_SKIP" } : {}),
    })
    .where(eq(interviewQuestionsTable.id, questionId));

  const [answer] = await db
    .insert(interviewAnswersTable)
    .values({
      interviewId,
      questionId,
      answerData: "",
      answerType: "TEXT",
      answeredAt: now,
    })
    .returning();

  return answer;
}

// ── Services ── (continued)
export async function cancelInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus as InterviewStatus, "CANCELLED");
}

export async function endInterviewService(authreq: AuthenticatedRequest, interviewId: string) {
  const interview = await resolveInterview(authreq, interviewId);
  return transitionInterview(interviewId, interview.interviewStatus as InterviewStatus, "COMPLETED");
}

// System-driven abandonment — called by the stale detection job, not by users
export async function abandonInterviewService(interviewId: string) {
  const db = getPgDb();
  const interview = await fetchInterviewById(interviewId);
  if (!interview) return null;
  assertValidTransition(interview.interviewStatus as InterviewStatus, "ABANDONED");
  const [updated] = await db
    .update(interviewsTable)
    .set({ interviewStatus: "ABANDONED", lastActivityAt: new Date() })
    .where(eq(interviewsTable.id, interviewId))
    .returning();
  return updated;
}

// Stale detection — finds INPROGRESS interviews inactive beyond the threshold
export async function detectAndAbandonStaleInterviews() {
  const db = getPgDb();
  const threshold = new Date(Date.now() - ABANDONMENT_THRESHOLD_MS);

  const stale = await db
    .select({ id: interviewsTable.id })
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.interviewStatus, "INPROGRESS"),
        lt(interviewsTable.lastActivityAt, threshold),
      ),
    );

  if (stale.length === 0) return { abandoned: 0 };

  await db
    .update(interviewsTable)
    .set({ interviewStatus: "ABANDONED" })
    .where(inArray(interviewsTable.id, stale.map((r) => r.id)));

  return { abandoned: stale.length };
}

export async function getInterviewHistoryService(authreq: AuthenticatedRequest, interviewId: string) {
  const db = getPgDb();

  const interview = await resolveInterview(authreq, interviewId);

  if (!TERMINAL_STATUSES.includes(interview.interviewStatus as InterviewStatus)) {
    throw new AppError(
      "History is only available for finished interviews",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }

  const questions = await db
    .select({
      questionId:       interviewQuestionsTable.id,
      sequenceNumber:   interviewQuestionsTable.sequenceNumber,
      questionTitle:    interviewQuestionsTable.questionTitle,
      questionType:     interviewQuestionsTable.questionType,
      questionState:    interviewQuestionsTable.questionState,
      timedOutAt:       interviewQuestionsTable.timedOutAt,
      timeoutBehavior:  interviewQuestionsTable.timeoutBehavior,
      answerId:         interviewAnswersTable.id,
      answerData:       interviewAnswersTable.answerData,
      answerType:       interviewAnswersTable.answerType,
      answerState:      interviewAnswersTable.answerState,
      evaluationData:   interviewAnswersTable.evaluationData,
      answeredAt:       interviewAnswersTable.answeredAt,
    })
    .from(interviewQuestionsTable)
    .leftJoin(
      interviewAnswersTable,
      eq(interviewAnswersTable.questionId, interviewQuestionsTable.id),
    )
    .where(eq(interviewQuestionsTable.interviewId, interviewId))
    .orderBy(interviewQuestionsTable.sequenceNumber);

  return {
    interviewId,
    interviewStatus: interview.interviewStatus,
    questions,
  };
}

export async function submitAnswerService(
  authreq: AuthenticatedRequest,
  interviewId: string,
  payload: { questionId: string; answerData: string; answerType: "TEXT" | "AUDIO" | "VIDEO" },
) {
  const interview = await resolveInterview(authreq, interviewId);

  if (interview.interviewStatus !== "INPROGRESS") {
    throw new AppError(
      "Answers can only be submitted while the interview is INPROGRESS",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
  }

  const db = getPgDb();
  const now = new Date();
  const isEmpty = payload.answerData.trim().length === 0;

  // Empty answer = treat as skipped
  if (isEmpty) {
    return skipQuestionInternal(db, interviewId, payload.questionId, now, "SKIPPED");
  }

  // Bump lastActivityAt on every real answer submission
  await db
    .update(interviewsTable)
    .set({ lastActivityAt: now })
    .where(eq(interviewsTable.id, interviewId));

  await db
    .update(interviewQuestionsTable)
    .set({ questionState: "ANSWERED" })
    .where(eq(interviewQuestionsTable.id, payload.questionId));

  const [answer] = await db
    .insert(interviewAnswersTable)
    .values({
      interviewId,
      questionId: payload.questionId,
      answerData: payload.answerData,
      answerType: payload.answerType,
      answeredAt: now,
    })
    .returning();

  return answer;
}

// Detects PENDING questions whose interview started > QUESTION_TIMEOUT_MS ago and marks them TIMED_OUT
export async function detectAndTimeoutStaleQuestions() {
  const db = getPgDb();
  const now = new Date();
  const threshold = new Date(now.getTime() - QUESTION_TIMEOUT_MS);

  // Find PENDING questions belonging to INPROGRESS interviews that started before the threshold
  const stale = await db
    .select({
      questionId: interviewQuestionsTable.id,
      interviewId: interviewQuestionsTable.interviewId,
    })
    .from(interviewQuestionsTable)
    .innerJoin(interviewsTable, eq(interviewQuestionsTable.interviewId, interviewsTable.id))
    .where(
      and(
        eq(interviewQuestionsTable.questionState, "PENDING"),
        eq(interviewsTable.interviewStatus, "INPROGRESS"),
        lt(interviewsTable.lastActivityAt, threshold),
      ),
    );

  if (stale.length === 0) return { timedOut: 0 };

  for (const { questionId, interviewId } of stale) {
    await skipQuestionInternal(db, interviewId, questionId, now, "TIMED_OUT");
  }

  return { timedOut: stale.length };
}

// Detects INPROGRESS interviews whose wall-clock duration has been exceeded and transitions them to TIMED_OUT
export async function detectAndTimeoutOverdueInterviews() {
  const db = getPgDb();
  const now = new Date();

  // interviewDuration is stored in minutes; find interviews where startedAt + duration < now
  const overdue = await db
    .select({ id: interviewsTable.id, interviewDuration: interviewsTable.interviewDuration, interviewStartedAt: interviewsTable.interviewStartedAt })
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.interviewStatus, "INPROGRESS"),
      ),
    );

  const expired = overdue.filter((r) => {
    if (!r.interviewStartedAt) return false;
    const deadlineMs = r.interviewStartedAt.getTime() + r.interviewDuration * 60 * 1000;
    return now.getTime() >= deadlineMs;
  });

  if (expired.length === 0) return { timedOut: 0 };

  await db
    .update(interviewsTable)
    .set({ interviewStatus: "TIMED_OUT", lastActivityAt: now })
    .where(inArray(interviewsTable.id, expired.map((r) => r.id)));

  return { timedOut: expired.length };
}

// Called by the evaluation pipeline once an answer has been scored
export async function markQuestionEvaluatedService(questionId: string, answerId: string) {
  const db = getPgDb();
  await db
    .update(interviewQuestionsTable)
    .set({ questionState: "EVALUATED" })
    .where(eq(interviewQuestionsTable.id, questionId));
  const [answer] = await db
    .update(interviewAnswersTable)
    .set({ answerState: "EVALUATED" })
    .where(eq(interviewAnswersTable.id, answerId))
    .returning();
  return answer;
}

export async function getInterviewMetricsService(authreq: AuthenticatedRequest, interviewId: string) {
  const db = getPgDb();

  const [interview] = await db
    .select({
      id: interviewsTable.id,
      interviewStatus: interviewsTable.interviewStatus,
      interviewDuration: interviewsTable.interviewDuration,
      interviewQuestionsGeneratedCount: interviewsTable.interviewQuestionsGeneratedCount,
      interviewQuestionsAnsweredCount: interviewsTable.interviewQuestionsAnsweredCount,
      interviewOutcome: interviewsTable.interviewOutcome,
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
    })
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.id, interviewId),
        eq(interviewsTable.userId, authreq.auth.userId),
        // Exclude abandoned/cancelled from metrics
        notInArray(interviewsTable.interviewStatus, TERMINAL_STATUSES.filter((s) => s !== "COMPLETED")),
      ),
    );

  if (!interview) {
    throw new AppError("Interview not found or not eligible for metrics", StatusCodes.NOT_FOUND, ErrorCodes.INTERVIEW_NOT_FOUND, { isOperational: true });
  }

  if (interview.interviewStatus !== "COMPLETED") {
    throw new AppError("Metrics are only available for completed interviews", StatusCodes.BAD_REQUEST, ErrorCodes.INTERVIEW_INVALID_STATE, { isOperational: true });
  }

  return {
    interviewId: interview.id,
    status: interview.interviewStatus,
    duration: interview.interviewDuration,
    questionsGenerated: interview.interviewQuestionsGeneratedCount,
    questionsAnswered: interview.interviewQuestionsAnsweredCount,
    outcome: interview.interviewOutcome,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  };
}
