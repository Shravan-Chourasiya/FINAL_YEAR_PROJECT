// ── Pattern Detection ─────────────────────────────────────────────────────────
// Pure function — reads performance state and question history, returns
// categorised detection flags.
//
// Rules are deliberately conservative: a single bad answer never over-triggers.
// Strong/weak area detection requires ≥ STREAK_THRESHOLD consecutive signals.

import type { CandidatePerformanceState } from "./performance.state.js";
import type { QuestionHistoryEntry } from "../ai.graph.types.js";

// ── Thresholds ────────────────────────────────────────────────────────────────

const STREAK_THRESHOLD = 2; // consecutive signals needed for strong/weak area
const TOPIC_WEAK_AVG = 45; // topic average below this = weak area (with ≥2 questions)
const TOPIC_STRONG_AVG = 75; // topic average above this = strong area (with ≥2 questions)
const TOPIC_MIN_QUESTIONS = 2; // minimum questions on a topic before area detection fires

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PatternDetection {
  strongArea: boolean; // sustained high performance on current topic
  weakArea: boolean; // sustained low performance or struggle on current topic
  vague: boolean; // latest answer was vague (on-topic, lacks depth)
  incomplete: boolean; // latest answer was incomplete or empty
  offTopic: boolean; // latest answer was off-topic
  // Human-readable reasons for each active flag (for audit trail)
  reasons: Partial<Record<keyof Omit<PatternDetection, "reasons">, string>>;
}

// ── detectPatterns ────────────────────────────────────────────────────────────

export function detectPatterns(
  state: CandidatePerformanceState,
  history: QuestionHistoryEntry[],
): PatternDetection {
  const reasons: PatternDetection["reasons"] = {};

  // ── Single-turn signals (from the most recent evaluation) ─────────────────
  const vague = state.lastSignals.includes("vague");
  const incomplete = state.lastSignals.includes("incomplete");
  const offTopic = state.lastSignals.includes("off_topic");

  if (vague) reasons.vague = "Latest answer flagged as vague by evaluator";
  if (incomplete) reasons.incomplete = "Latest answer flagged as incomplete by evaluator";
  if (offTopic) reasons.offTopic = "Latest answer flagged as off-topic by evaluator";

  // ── Current topic (from most recent answered question) ────────────────────
  const lastAnswered = [...history].reverse().find((h) => h.wasAnswered);
  const currentTopic = lastAnswered?.questionType ?? null;

  // ── Strong area: streak-based OR topic average ────────────────────────────
  let strongArea = false;
  if (state.strongStreak >= STREAK_THRESHOLD) {
    strongArea = true;
    reasons.strongArea = `Strong streak of ${state.strongStreak} consecutive strong answers`;
  } else if (currentTopic) {
    const ts = state.topicScores.find((t) => t.topic === currentTopic);
    if (ts && ts.questionCount >= TOPIC_MIN_QUESTIONS && ts.averageScore >= TOPIC_STRONG_AVG) {
      strongArea = true;
      reasons.strongArea = `Topic "${currentTopic}" average ${ts.averageScore} over ${ts.questionCount} questions`;
    }
  }

  // ── Weak area: streak-based OR topic average ──────────────────────────────
  let weakArea = false;
  if (state.weakStreak >= STREAK_THRESHOLD) {
    weakArea = true;
    reasons.weakArea = `Weak streak of ${state.weakStreak} consecutive weak answers`;
  } else if (currentTopic) {
    const ts = state.topicScores.find((t) => t.topic === currentTopic);
    if (ts && ts.questionCount >= TOPIC_MIN_QUESTIONS && ts.averageScore <= TOPIC_WEAK_AVG) {
      weakArea = true;
      reasons.weakArea = `Topic "${currentTopic}" average ${ts.averageScore} over ${ts.questionCount} questions`;
    }
  }

  // Strong and weak are mutually exclusive — strong wins on a tie (shouldn't happen)
  if (strongArea && weakArea) weakArea = false;

  return { strongArea, weakArea, vague, incomplete, offTopic, reasons };
}
