// ── Adaptation Decision Engine ────────────────────────────────────────────────
// Pure function — given performance state, pattern detections, interview config,
// and question history, returns a concrete AdaptationDecision.
//
// Every decision includes a human-readable `reason` for the audit trail.
// The engine is deterministic: same inputs → same output, always.
//
// Constraints enforced:
//   - Never escalate past the interview's configured max difficulty
//   - Never change topics if the interview type is BEHAVIORAL (single-topic)
//   - Probe-further is capped at maxFollowUps to prevent infinite probing
//   - Early termination only when conditions are unambiguous

import type { CandidatePerformanceState } from "./performance.state.js";
import type { PatternDetection } from "./detection.js";
import type { QuestionHistoryEntry } from "../ai.graph.types.js";
import type { InterviewConfig } from "../../../modules/interview/types/interview.context.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdaptationAction =
  | "follow_up" // ask a follow-up on the same topic/difficulty
  | "harder" // escalate difficulty
  | "easier" // de-escalate difficulty
  | "new_topic" // pivot to a different topic
  | "terminate"; // end the interview early

export interface AdaptationHint {
  mode: "initial" | "follow_up" | "topic_change"; // maps to InterviewerMode
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topicHint?: string; // passed to the prompt when changing topics
}

export interface AdaptationDecision {
  action: AdaptationAction;
  reason: string; // human-readable, stored in audit trail
  hint: AdaptationHint; // passed to the next question generator
  decidedAt: string; // ISO-8601 timestamp
}

// ── Difficulty ladder ─────────────────────────────────────────────────────────

const DIFFICULTY_ORDER: ("EASY" | "MEDIUM" | "HARD")[] = ["EASY", "MEDIUM", "HARD"];

function escalate(d: "EASY" | "MEDIUM" | "HARD"): "EASY" | "MEDIUM" | "HARD" {
  const idx = DIFFICULTY_ORDER.indexOf(d);
  return DIFFICULTY_ORDER[Math.min(idx + 1, DIFFICULTY_ORDER.length - 1)] ?? d;
}

function deescalate(d: "EASY" | "MEDIUM" | "HARD"): "EASY" | "MEDIUM" | "HARD" {
  const idx = DIFFICULTY_ORDER.indexOf(d);
  return DIFFICULTY_ORDER[Math.max(idx - 1, 0)] ?? d;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

const STRONG_STREAK_FOR_ESCALATION = 2; // consecutive strong answers → harder
const WEAK_STREAK_FOR_DEESCALATION = 2; // consecutive weak answers → easier or new_topic
const WEAK_STREAK_FOR_TOPIC_CHANGE = 3; // sustained weakness → new_topic
const EARLY_TERM_WEAK_STREAK = 5; // sustained inability to progress → terminate
const EARLY_TERM_COVERAGE_RATIO = 0.85; // 85% of duration covered + strong avg → terminate

// ── computeAdaptation ─────────────────────────────────────────────────────────

export function computeAdaptation(
  state: CandidatePerformanceState,
  detection: PatternDetection,
  config: InterviewConfig,
  history: QuestionHistoryEntry[],
): AdaptationDecision {
  const now = new Date().toISOString();
  const difficulty = state.currentDifficulty;
  const canEscalate = escalate(difficulty) !== difficulty;
  const canDeescalate = deescalate(difficulty) !== difficulty;

  // Topics can only change for TECHNICAL or MIXED interviews
  const canChangeTopic = config.interviewType !== "BEHAVIORAL";

  // ── 1. Early termination — sustained inability to progress ────────────────
  if (state.weakStreak >= EARLY_TERM_WEAK_STREAK) {
    return {
      action: "terminate",
      reason: `Candidate has not progressed after ${state.weakStreak} consecutive weak answers — ending interview early`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 2. Early termination — topic coverage achieved + strong performance ───
  const totalAnswered = state.answeredCount;
  const estimatedTotal = Math.floor(config.durationMinutes / 5); // ~1 question per 5 min
  const coverageRatio = estimatedTotal > 0 ? totalAnswered / estimatedTotal : 0;
  if (coverageRatio >= EARLY_TERM_COVERAGE_RATIO && state.averageScore >= 75) {
    return {
      action: "terminate",
      reason: `Interview coverage at ${Math.round(coverageRatio * 100)}% with strong average score ${state.averageScore} — ending early`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 3. Vague/incomplete — probe further (capped at maxFollowUps) ──────────
  if ((detection.vague || detection.incomplete) && state.probeCount < config.maxFollowUps) {
    const signal = detection.vague ? "vague" : "incomplete";
    return {
      action: "follow_up",
      reason: `Answer was ${signal} — probing further (probe ${state.probeCount + 1}/${config.maxFollowUps})`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 4. Vague/incomplete — probe limit reached, move on ───────────────────
  if ((detection.vague || detection.incomplete) && state.probeCount >= config.maxFollowUps) {
    if (canChangeTopic) {
      return {
        action: "new_topic",
        reason: `Probe limit (${config.maxFollowUps}) reached on vague/incomplete answers — moving to new topic`,
        hint: { mode: "topic_change", difficulty },
        decidedAt: now,
      };
    }
    return {
      action: "follow_up",
      reason: `Probe limit reached but topic change not allowed for ${config.interviewType} — continuing with follow-up`,
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 5. Off-topic — always move on (don't probe an off-topic answer) ───────
  if (detection.offTopic) {
    if (canChangeTopic) {
      return {
        action: "new_topic",
        reason: "Answer was off-topic — pivoting to a new topic",
        hint: { mode: "topic_change", difficulty },
        decidedAt: now,
      };
    }
    return {
      action: "follow_up",
      reason: "Answer was off-topic — asking a clearer follow-up",
      hint: { mode: "follow_up", difficulty },
      decidedAt: now,
    };
  }

  // ── 6. Strong area — escalate difficulty ─────────────────────────────────
  if (detection.strongArea && state.strongStreak >= STRONG_STREAK_FOR_ESCALATION) {
    if (canEscalate) {
      const newDiff = escalate(difficulty);
      return {
        action: "harder",
        reason: `${detection.reasons.strongArea ?? "Strong performance"} — escalating to ${newDiff}`,
        hint: { mode: "follow_up", difficulty: newDiff },
        decidedAt: now,
      };
    }
    // Already at max difficulty — change topic to keep it interesting
    if (canChangeTopic) {
      return {
        action: "new_topic",
        reason: `Strong performance but already at max difficulty (${difficulty}) — changing topic`,
        hint: { mode: "topic_change", difficulty },
        decidedAt: now,
      };
    }
  }

  // ── 7. Weak area — de-escalate or change topic ────────────────────────────
  if (detection.weakArea) {
    if (state.weakStreak >= WEAK_STREAK_FOR_TOPIC_CHANGE && canChangeTopic) {
      return {
        action: "new_topic",
        reason: `${detection.reasons.weakArea ?? "Weak performance"} — changing topic after ${state.weakStreak} weak answers`,
        hint: {
          mode: "topic_change",
          difficulty: canDeescalate ? deescalate(difficulty) : difficulty,
        },
        decidedAt: now,
      };
    }
    if (state.weakStreak >= WEAK_STREAK_FOR_DEESCALATION && canDeescalate) {
      const newDiff = deescalate(difficulty);
      return {
        action: "easier",
        reason: `${detection.reasons.weakArea ?? "Weak performance"} — de-escalating to ${newDiff}`,
        hint: { mode: "follow_up", difficulty: newDiff },
        decidedAt: now,
      };
    }
  }

  // ── 8. Default — follow-up at current difficulty ──────────────────────────
  return {
    action: "follow_up",
    reason: "No significant pattern detected — continuing with follow-up at current difficulty",
    hint: { mode: "follow_up", difficulty },
    decidedAt: now,
  };
}
