import { create } from "zustand";
import type { Evaluation, Question } from "../types";
import type { BackendInterviewStatus } from "../types/api";

export type LiveConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";
export type LiveAiStatus = "idle" | "thinking" | "generating" | "evaluating";

export type LiveInterviewState = {
  interviewId: string | null;
  connectionState: LiveConnectionState;
  interviewStatus: BackendInterviewStatus | null;
  timerStartedAt: string | null;
  durationMinutes: number | null;
  remainingSeconds: number;
  currentQuestion: Question | null;
  questionNumber: number;
  totalQuestions: number | null;
  aiStatus: LiveAiStatus;
  lastEvaluation: Evaluation | null;
  transcript: string[];
  error: string | null;
  setConnectionState: (connectionState: LiveConnectionState) => void;
  setInterviewId: (interviewId: string) => void;
  applyJoined: (payload: {
    interviewId: string;
    timerStartedAt: string;
    durationMinutes: number;
  }) => void;
  applyStateChange: (status: BackendInterviewStatus) => void;
  applyQuestion: (
    question: Question,
    questionNumber: number,
    totalQuestions: number | null,
  ) => void;
  setAiStatus: (aiStatus: LiveAiStatus) => void;
  applyEvaluation: (evaluation: Evaluation) => void;
  setRemainingSeconds: (remainingSeconds: number) => void;
  appendTranscript: (entry: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

const initialState = {
  interviewId: null,
  connectionState: "idle" as LiveConnectionState,
  interviewStatus: null,
  timerStartedAt: null,
  durationMinutes: null,
  remainingSeconds: 0,
  currentQuestion: null,
  questionNumber: 0,
  totalQuestions: null,
  aiStatus: "idle" as LiveAiStatus,
  lastEvaluation: null,
  transcript: [],
  error: null,
};

export const useLiveInterviewStore = create<LiveInterviewState>((set) => ({
  ...initialState,
  setConnectionState: (connectionState) => set({ connectionState }),
  setInterviewId: (interviewId) => set({ interviewId }),
  applyJoined: ({ interviewId, timerStartedAt, durationMinutes }) =>
    set({
      interviewId,
      timerStartedAt,
      durationMinutes,
      remainingSeconds: durationMinutes * 60,
    }),
  applyStateChange: (interviewStatus) => set({ interviewStatus }),
  applyQuestion: (currentQuestion, questionNumber, totalQuestions) =>
    set({
      currentQuestion,
      questionNumber,
      totalQuestions,
      lastEvaluation: null,
      aiStatus: "idle",
    }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  applyEvaluation: (lastEvaluation) => set({ lastEvaluation }),
  setRemainingSeconds: (remainingSeconds) => set({ remainingSeconds }),
  appendTranscript: (entry) =>
    set((state) => ({ transcript: [...state.transcript, entry] })),
  setError: (error) => set({ error }),
  reset() {
    set(initialState);
  },
}));
