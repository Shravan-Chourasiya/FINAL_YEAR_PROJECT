import { httpGet, httpPost, httpPut } from "../http";
import { ENDPOINTS } from "../constants/endpoints";
import type {
  InterviewResponse,
  CreateInterviewResponse,
  InterviewMetricsResponse,
  InterviewReportResponse,
  AnswerRequest,
} from "../types/api";
import type { InterviewConfig, TimelineEvent } from "../types";

// ── List ──────────────────────────────────────────────────────────────────────

export function listInterviews(): Promise<InterviewResponse[]> {
  return httpGet<InterviewResponse[]>(ENDPOINTS.interviews.list);
}

// ── Resumable ─────────────────────────────────────────────────────────────────

export function resumableInterviews(): Promise<InterviewResponse[]> {
  return httpGet<InterviewResponse[]>(ENDPOINTS.interviews.resumable);
}

// ── Create ────────────────────────────────────────────────────────────────────

export function createInterview(
  body: InterviewConfig,
): Promise<CreateInterviewResponse> {
  return httpPost<CreateInterviewResponse>(ENDPOINTS.interviews.create, body);
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export function getInterview(id: string): Promise<InterviewResponse> {
  return httpGet<InterviewResponse>(ENDPOINTS.interviews.byId(id));
}

// ── History ───────────────────────────────────────────────────────────────────

export function getInterviewHistory(id: string): Promise<TimelineEvent[]> {
  return httpGet<TimelineEvent[]>(ENDPOINTS.interviews.history(id));
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function getInterviewMetrics(
  id: string,
): Promise<InterviewMetricsResponse> {
  return httpGet<InterviewMetricsResponse>(ENDPOINTS.interviews.metrics(id));
}

// ── Report ────────────────────────────────────────────────────────────────────

export function getInterviewReport(
  id: string,
): Promise<InterviewReportResponse> {
  return httpGet<InterviewReportResponse>(ENDPOINTS.interviews.report(id));
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.start(id));
}

// ── Pause ─────────────────────────────────────────────────────────────────────

export function pauseInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.pause(id));
}

// ── Resume ────────────────────────────────────────────────────────────────────

export function resumeInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.resume(id));
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export function cancelInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.cancel(id));
}

// ── End ───────────────────────────────────────────────────────────────────────

export function endInterview(id: string): Promise<void> {
  return httpPost(ENDPOINTS.interviews.end(id));
}

// ── Submit answer ─────────────────────────────────────────────────────────────

export function submitAnswer(
  interviewId: string,
  body: AnswerRequest,
): Promise<void> {
  return httpPut(ENDPOINTS.interviews.answer(interviewId, body.questionId), body);
}
