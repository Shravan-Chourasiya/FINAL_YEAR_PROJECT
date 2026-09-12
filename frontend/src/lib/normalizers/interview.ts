import type { InterviewResponse } from "../types/api";
import type { Difficulty, Interview, InterviewStatus, InterviewType } from "../types";

type BackendInterview = InterviewResponse & {
  interviewStatus?: InterviewResponse["status"];
  interviewDifficulty?: string;
  interviewType?: string;
  interviewDuration?: number;
  interviewMetaData?: { jobRole?: string; jobSkills?: string[] };
};

function normalizeStatus(status: InterviewResponse["status"]): InterviewStatus {
  if (status === "INPROGRESS") return "IN_PROGRESS";
  if (status === "DRAFT") return "CREATED";
  if (status === "SCHEDULED") return "READY";
  if (status === "TIMED_OUT" || status === "EXPIRED") return "ABANDONED";
  return status as InterviewStatus;
}

function normalizeDifficulty(value: string | undefined): Difficulty {
  if (value?.toLowerCase() === "easy") return "Easy";
  if (value?.toLowerCase() === "hard") return "Hard";
  if (value?.toLowerCase() === "adaptive") return "Adaptive";
  return "Medium";
}

function normalizeType(value: string | undefined): InterviewType {
  if (value?.toLowerCase() === "behavioral") return "Behavioral";
  if (value?.toLowerCase() === "technical") return "Technical";
  if (value?.toLowerCase() === "coding") return "Coding";
  return "Mixed";
}

export function normalizeInterview(value: InterviewResponse): Interview {
  const raw = value as BackendInterview & Partial<Interview>;
  return {
    ...(raw as Interview),
    id: raw.id,
    userId: raw.userId,
    status: normalizeStatus(raw.interviewStatus ?? raw.status),
    difficulty: normalizeDifficulty(raw.interviewDifficulty),
    type: normalizeType(raw.interviewType),
    roleTitle: raw.interviewMetaData?.jobRole ?? "Software Engineer",
    domain: raw.interviewMetaData?.jobRole ?? "Software Engineering",
    experienceLevel: "Entry",
    rounds: raw.rounds ?? 1,
    topics: raw.interviewMetaData?.jobSkills ?? [],
    durationMin: raw.interviewDuration ?? 0,
    createdAt: raw.createdAt,
    lastActivityAt: raw.lastActivityAt ?? raw.createdAt,
    progress: raw.progress ?? 0,
    score: raw.score ?? null,
    currentRound: raw.currentRound ?? 1,
    currentQuestion: raw.currentQuestion ?? 0,
  };
}
