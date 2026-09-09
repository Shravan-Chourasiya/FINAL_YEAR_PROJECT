// ── Candidate Performance State ───────────────────────────────────────────────
// Tracks the running picture of candidate performance across the interview.
// Persisted inside InterviewContext in Redis so a resume never loses context.
//
// All functions are pure — no side effects, no I/O.

import type {
  DetectionSignal,
  EvaluationResultShape,
  QuestionHistoryEntry,
} from "../ai.graph.types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopicScore {
  topic: string;
  scores: number[]; // raw scores, capped at last 5
  averageScore: number;
  questionCount: number;
}

export interface CandidatePerformanceState {
  // Overall
  averageScore: number;
  answeredCount: number;
  skippedCount: number;
  timedOutCount: number;

  // Per-topic rolling averages (keyed by questionType;
  // Step 18 topic-change logic extends this to semantic topics)
  topicScores: TopicScore[];

  // Difficulty trend
  currentDifficulty: "EASY" | "MEDIUM" | "HARD";
  difficultyHistory: ("EASY" | "MEDIUM" | "HARD")[]; // one entry per question

  // Streak tracking — consecutive strong/weak signals
  strongStreak: number; // consecutive questions with "strong" signal
  weakStreak: number; // consecutive questions with "weak" signal
  probeCount: number; // consecutive vague/incomplete probes on same topic

  // Last evaluation signals (for single-turn detection)
  lastSignals: DetectionSignal[];
}

export function initialPerformanceState(
  difficulty: "EASY" | "MEDIUM" | "HARD",
): CandidatePerformanceState {
  return {
    averageScore: 0,
    answeredCount: 0,
    skippedCount: 0,
    timedOutCount: 0,
    topicScores: [],
    currentDifficulty: difficulty,
    difficultyHistory: [],
    strongStreak: 0,
    weakStreak: 0,
    probeCount: 0,
    lastSignals: [],
  };
}

// ── updatePerformanceState ────────────────────────────────────────────────────
// Pure — takes current state + one evaluation result, returns new state.
// Called after every evaluated answer. Never mutates the input.

const MAX_TOPIC_SCORES_KEPT = 5;

export function updatePerformanceState(
  current: CandidatePerformanceState,
  evalResult: EvaluationResultShape,
  entry: QuestionHistoryEntry,
): CandidatePerformanceState {
  const signals = evalResult.detectionSignals;
  const score = evalResult.score;
  const topic = entry.questionType;

  // ── Per-topic scores ──────────────────────────────────────────────────────
  const existingTopic = current.topicScores.find((t) => t.topic === topic);
  let topicScores: TopicScore[];

  if (existingTopic) {
    const newScores = [...existingTopic.scores, score].slice(-MAX_TOPIC_SCORES_KEPT);
    const avg = newScores.reduce((a, b) => a + b, 0) / newScores.length;
    topicScores = current.topicScores.map((t) =>
      t.topic === topic
        ? {
            ...t,
            scores: newScores,
            averageScore: Math.round(avg),
            questionCount: t.questionCount + 1,
          }
        : t,
    );
  } else {
    topicScores = [
      ...current.topicScores,
      { topic, scores: [score], averageScore: score, questionCount: 1 },
    ];
  }

  // ── Overall average ───────────────────────────────────────────────────────
  const newAnsweredCount = current.answeredCount + 1;
  const newAverage = Math.round(
    (current.averageScore * current.answeredCount + score) / newAnsweredCount,
  );

  // ── Streaks ───────────────────────────────────────────────────────────────
  const isStrong = signals.includes("strong");
  const isWeak = signals.includes("weak");
  const isVagueOrInc = signals.includes("vague") || signals.includes("incomplete");

  return {
    ...current,
    averageScore: newAverage,
    answeredCount: newAnsweredCount,
    topicScores,
    difficultyHistory: [...current.difficultyHistory, current.currentDifficulty],
    strongStreak: isStrong ? current.strongStreak + 1 : 0,
    weakStreak: isWeak ? current.weakStreak + 1 : 0,
    probeCount: isVagueOrInc ? current.probeCount + 1 : 0,
    lastSignals: signals,
  };
}

export function updateSkipCount(current: CandidatePerformanceState): CandidatePerformanceState {
  return {
    ...current,
    skippedCount: current.skippedCount + 1,
    strongStreak: 0,
    weakStreak: 0,
    probeCount: 0,
  };
}

export function updateTimeoutCount(current: CandidatePerformanceState): CandidatePerformanceState {
  return {
    ...current,
    timedOutCount: current.timedOutCount + 1,
    strongStreak: 0,
    weakStreak: 0,
    probeCount: 0,
  };
}
