import { create } from "zustand";
import * as interviewService from "../services/interview.service";
import type { BackendInterviewStatus } from "../types/api";
import type { Interview, InterviewConfig } from "../types";

const CACHE_TTL_MS = 30_000;

function normalizeStatus(status: BackendInterviewStatus): Interview["status"] {
  if (status === "INPROGRESS") return "IN_PROGRESS";
  if (status === "DRAFT") return "CREATED";
  if (status === "SCHEDULED") return "READY";
  if (status === "TIMED_OUT" || status === "EXPIRED") return "ABANDONED";
  return status as Interview["status"];
}

function normalizeInterview(
  value: Awaited<ReturnType<typeof interviewService.listInterviews>>[number],
): Interview {
  const raw = value as typeof value & Partial<Interview>;
  return {
    ...raw,
    id: value.id,
    userId: value.userId,
    status: normalizeStatus(value.status),
    createdAt: value.createdAt,
    lastActivityAt: value.lastActivityAt ?? value.createdAt,
    progress: raw.progress ?? 0,
    score: raw.score ?? null,
    currentRound: raw.currentRound ?? 1,
    currentQuestion: raw.currentQuestion ?? 0,
  } as Interview;
}

type InterviewListState = {
  interviews: Interview[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  fetchedAt: number | null;
  fetchInterviews: (options?: { force?: boolean }) => Promise<Interview[]>;
  createInterview: (config: InterviewConfig) => Promise<string>;
  cancelInterview: (id: string) => Promise<void>;
  reset: () => void;
};

let inFlight: Promise<Interview[]> | null = null;

export const useInterviewListStore = create<InterviewListState>((set, get) => ({
  interviews: [],
  status: "idle",
  error: null,
  fetchedAt: null,

  async fetchInterviews({ force = false } = {}) {
    const current = get();
    if (
      !force &&
      current.status === "ready" &&
      current.fetchedAt &&
      Date.now() - current.fetchedAt < CACHE_TTL_MS
    ) {
      return current.interviews;
    }
    if (inFlight) return inFlight;

    set({ status: "loading", error: null });
    inFlight = interviewService
      .listInterviews()
      .then((response) => response.map(normalizeInterview))
      .then((interviews) => {
        set({
          interviews,
          status: "ready",
          error: null,
          fetchedAt: Date.now(),
        });
        return interviews;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  },

  async createInterview(config) {
    const response = await interviewService.createInterview(config);
    await get().fetchInterviews({ force: true });
    return response.id ?? response.interviewId ?? "";
  },

  async cancelInterview(id) {
    const previous = get().interviews;
    set({
      interviews: previous.map((interview) =>
        interview.id === id ? { ...interview, status: "CANCELLED" } : interview,
      ),
    });
    try {
      await interviewService.cancelInterview(id);
      await get().fetchInterviews({ force: true });
    } catch (error) {
      set({ interviews: previous });
      throw error;
    }
  },

  reset() {
    set({ interviews: [], status: "idle", error: null, fetchedAt: null });
  },
}));
