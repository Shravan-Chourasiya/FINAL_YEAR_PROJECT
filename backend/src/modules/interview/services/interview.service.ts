import { eq, and } from "drizzle-orm";
import getPgDb from "../../../db/postgres.init.js";
import { interviewsTable } from "../schemas/interview.schema.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";

export async function createInterviewService(
  authreq: AuthenticatedRequest,
  interviewData: {
    jobrole: string;
    experience: string;
    interviewStyle: "MANGOS" | "FAANG" | "MAANG" | "STARTUP" | "CUSTOM";
    interviewType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
    duration: number;
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
      interviewMetaData: {
        jobRole: interviewData.jobrole,
        interviewCompanyStyle: interviewData.interviewStyle,
        interviewType: interviewData.interviewType,
      },
      interviewDuration: interviewData.duration,
      interviewStatus: "DRAFT",
      isInterviewScheduled: interviewData.isScheduled,
      interviewScheduledDate: interviewData.isScheduled ? interviewData.scheduledDate : null,
    })
    .returning();

  return interview;
}

export async function getAllInterviewsService(authreq: AuthenticatedRequest) {
  const db = getPgDb();

  const interviews = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.userId, authreq.auth.userId));

  return interviews;
}

export async function getInterviewByIdService(
  authreq: AuthenticatedRequest,
  interviewId: string,
) {
  const db = getPgDb();

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(
      and(
        eq(interviewsTable.id, interviewId),
        eq(interviewsTable.userId, authreq.auth.userId),
      ),
    );

  if (!interview) {
    throw new AppError(
      "Interview not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }

  return interview;
}

export async function getInterviewMetricsService(
  authreq: AuthenticatedRequest,
  interviewId: string,
) {
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
      ),
    );

  if (!interview) {
    throw new AppError(
      "Interview not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.INTERVIEW_NOT_FOUND,
      { isOperational: true },
    );
  }

  if (interview.interviewStatus !== "COMPLETED") {
    throw new AppError(
      "Metrics are only available for completed interviews",
      StatusCodes.BAD_REQUEST,
      ErrorCodes.INTERVIEW_INVALID_STATE,
      { isOperational: true },
    );
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
