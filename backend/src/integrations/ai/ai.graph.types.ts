// ── Shared AI sub-types ───────────────────────────────────────────────────────
// Plain TypeScript interfaces with no external dependencies.
// Imported by graph.state.ts, context.manager.ts, prompts.ts, and tests.
// Keeping these separate means tests never transitively load @langchain/langgraph.

export interface QuestionHistoryEntry {
  questionId: string;
  questionTitle: string;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
  sequenceNumber: number;
  wasAnswered: boolean;
  score: number | null;
}

export interface PerformanceMetrics {
  averageScore: number;
  answeredCount: number;
  skippedCount: number;
  timedOutCount: number;
  topicsCovered: string[];
}

export interface GraphTurnInput {
  operation: "generate" | "evaluate" | "end";
  sequenceNumber?: number;
  answerData?: string;
  answerType?: "TEXT" | "AUDIO" | "VIDEO";
  questionTitle?: string;
  endReason?: "COMPLETED" | "CANCELLED" | "ABANDONED" | "TIMED_OUT";
  // Adaptation hint — set by the adaptive engine, consumed by router + interviewer
  adaptationHint?: {
    mode: "initial" | "follow_up" | "topic_change";
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topicHint?: string;
  };
}

export interface GeneratedQuestionShape {
  questionTitle: string;
  questionDescription: string | null;
  questionType: "BEHAVIORAL" | "TECHNICAL" | "MIXED";
}

export type DetectionSignal = "strong" | "weak" | "vague" | "incomplete" | "off_topic" | "none";

export interface EvaluationResultShape {
  score: number;
  correctness: number;
  relevance: number;
  clarity: number;
  technicalDepth: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  detectionSignals: DetectionSignal[];
}

export type InterviewerMode = "initial" | "follow_up" | "topic_change";

export interface RoutingMetadata {
  mode: InterviewerMode | "evaluate" | "end" | "fallback";
  reason: string;
}
