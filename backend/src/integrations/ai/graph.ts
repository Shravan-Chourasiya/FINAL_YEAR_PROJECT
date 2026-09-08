// ── Interview LangGraph ───────────────────────────────────────────────────────
// Real node implementations for the interview graph.
//
//   router     — detects operation + sub-mode, sets routingDecision + routingMetadata
//   interviewer — builds prompt, calls model, checks for repetition
//   evaluator  — builds prompt, calls model, handles edge cases
//
// The graph is compiled once at module load and reused across all invocations.

import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { InterviewGraphAnnotation } from "./graph.state.js";
import type {
  InterviewGraphState,
  InterviewerMode,
  RoutingMetadata,
  DetectionSignal,
  QuestionHistoryEntry,
} from "./graph.state.js";
import { callGenerateWithFallback, callEvaluateWithFallback } from "./provider.js";
import { buildInterviewerPrompt, buildEvaluatorPrompt } from "./prompts.js";
import { trimHistory } from "./context.manager.js";
import { logger } from "../../utils/logger.js";

// ── Node: router ──────────────────────────────────────────────────────────────
// Reads currentInput.operation and history to determine:
//   - Which node to invoke (interviewer / evaluator / end)
//   - The sub-mode for the interviewer (initial / follow_up / topic_change)
//
// Malformed state (null currentInput, unknown operation) → route to "end"
// with mode "fallback" — never throws, never crashes the graph.

async function routerNode(state: InterviewGraphState): Promise<Partial<InterviewGraphState>> {
  const op = state.currentInput?.operation;

  if (!op || (op !== "generate" && op !== "evaluate" && op !== "end")) {
    const metadata: RoutingMetadata = {
      mode: "fallback",
      reason: `Malformed or missing operation: ${String(op)}`,
    };
    logger.warn(
      { interviewId: state.interviewId, op },
      "[graph] router — malformed state, routing to end",
    );
    return { routingDecision: "end", routingMetadata: metadata };
  }

  if (op === "end") {
    const metadata: RoutingMetadata = { mode: "end", reason: "Session end requested" };
    return { routingDecision: "end", routingMetadata: metadata };
  }

  if (op === "evaluate") {
    const metadata: RoutingMetadata = {
      mode: "evaluate",
      reason: "Answer submitted for evaluation",
    };
    logger.info({ interviewId: state.interviewId }, "[graph] router → evaluator");
    return { routingDecision: "evaluator", routingMetadata: metadata };
  }

  // op === "generate" — determine sub-mode
  // If the adaptive engine provided a hint, use it directly.
  const hint = state.currentInput?.adaptationHint;
  if (hint) {
    const metadata: RoutingMetadata = {
      mode: hint.mode,
      reason: `Adaptive engine decision: ${hint.mode} at ${hint.difficulty}${
        hint.topicHint ? ` (topic: ${hint.topicHint})` : ""
      }`,
    };
    logger.info(
      { interviewId: state.interviewId, mode: hint.mode, difficulty: hint.difficulty },
      "[graph] router → interviewer (adaptive)",
    );
    return { routingDecision: "interviewer", routingMetadata: metadata };
  }

  const answeredCount = state.questionHistory.filter(
    (h: QuestionHistoryEntry) => h.wasAnswered,
  ).length;
  const totalAsked = state.questionHistory.length;

  let mode: InterviewerMode;
  let reason: string;

  if (totalAsked === 0) {
    mode = "initial";
    reason = "No questions asked yet — generating opening question";
  } else if (state.currentInput?.sequenceNumber !== undefined && answeredCount > 0) {
    // If the adaptive engine sets a topic_change flag in the future, it will
    // pass it via currentInput. For now, follow_up is the default after the first question.
    mode = "follow_up";
    reason = `Follow-up after ${answeredCount} answered question(s)`;
  } else {
    mode = "follow_up";
    reason = "Continuing interview";
  }

  const metadata: RoutingMetadata = { mode, reason };
  logger.info({ interviewId: state.interviewId, mode, reason }, "[graph] router → interviewer");
  return { routingDecision: "interviewer", routingMetadata: metadata };
}

// ── Node: interviewer ─────────────────────────────────────────────────────────
// Generates the next question. Checks for repetition against history.
// If the model returns a question already asked, retries once with an explicit
// "avoid this question" instruction before accepting the result.

const MAX_REPETITION_RETRIES = 1;

async function interviewerNode(state: InterviewGraphState): Promise<Partial<InterviewGraphState>> {
  const mode = (state.routingMetadata?.mode ?? "follow_up") as InterviewerMode;
  // Use adaptive hint difficulty if provided, otherwise use state difficulty
  const hint = state.currentInput?.adaptationHint;
  const effectiveDiff = hint?.difficulty ?? state.difficulty;
  const providerName = "groq";
  const trimmedHistory = trimHistory(state.questionHistory, providerName);

  const input = {
    interviewId: state.interviewId,
    config: {
      interviewType: state.interviewType,
      interviewStyle: state.interviewStyle,
      difficulty: effectiveDiff,
      durationMinutes: state.durationMinutes,
      maxFollowUps: state.maxFollowUps,
      ...(state.jobRole ? { jobRole: state.jobRole } : {}),
      ...(state.jobSkills.length ? { jobSkills: state.jobSkills } : {}),
    },
    sequenceNumber: state.currentInput?.sequenceNumber ?? state.questionHistory.length + 1,
    previousQuestions: trimmedHistory.map((h: QuestionHistoryEntry) => ({
      questionTitle: h.questionTitle,
      questionType: h.questionType,
      wasAnswered: h.wasAnswered,
    })),
  };

  const askedTitles = new Set(
    state.questionHistory.map((h: QuestionHistoryEntry) => h.questionTitle.toLowerCase().trim()),
  );

  let prompt = buildInterviewerPrompt(state, mode, trimmedHistory, hint ?? null);
  let generated = await callGenerateWithFallback(prompt, input);

  // Repetition check — retry once if the model returned an already-asked question
  if (askedTitles.has(generated.questionTitle.toLowerCase().trim())) {
    logger.warn(
      { interviewId: state.interviewId, title: generated.questionTitle },
      "[graph] interviewer — repetition detected, retrying",
    );

    for (let i = 0; i < MAX_REPETITION_RETRIES; i++) {
      // Re-build prompt with the repeated title explicitly in the avoid list
      const extendedHistory = [
        ...trimmedHistory,
        // Inject the repeated question as a synthetic history entry so the prompt avoids it
        {
          questionId: "repeat-guard",
          questionTitle: generated.questionTitle,
          questionType: generated.questionType,
          sequenceNumber: input.sequenceNumber,
          wasAnswered: false,
          score: null,
        },
      ];
      prompt = buildInterviewerPrompt(state, mode, extendedHistory, hint ?? null);
      generated = await callGenerateWithFallback(prompt, input);
      if (!askedTitles.has(generated.questionTitle.toLowerCase().trim())) break;
    }
  }

  logger.info(
    { interviewId: state.interviewId, mode, title: generated.questionTitle },
    "[graph] interviewer — question generated",
  );
  return { generatedQuestion: generated };
}

// ── Node: evaluator ───────────────────────────────────────────────────────────
// Scores the candidate's answer. Handles edge cases before calling the model:
//   - Empty answer → score 0, signal "incomplete", skip model call
//   - Answer is a question back to the interviewer → signal "incomplete"
//   - Off-topic detection is left to the model (it has the question context)

const QUESTION_PATTERN =
  /^(what|how|why|when|where|who|can you|could you|would you|is it|are there|do you|does|did|will|should|shall)\b/i;

async function evaluatorNode(state: InterviewGraphState): Promise<Partial<InterviewGraphState>> {
  const answerData = state.currentInput?.answerData ?? "";
  const trimmed = answerData.trim();

  // Edge case: empty answer
  if (!trimmed) {
    logger.info({ interviewId: state.interviewId }, "[graph] evaluator — empty answer, scoring 0");
    return {
      evaluationResult: {
        score: 0,
        correctness: 0,
        relevance: 0,
        clarity: 0,
        technicalDepth: 0,
        feedback: "No answer was provided.",
        strengths: [],
        weaknesses: ["No answer provided"],
        detectionSignals: ["incomplete" as DetectionSignal],
      },
    };
  }

  // Edge case: answer is itself a question
  const isQuestion = QUESTION_PATTERN.test(trimmed) && trimmed.endsWith("?");
  const trimmedHistory = trimHistory(state.questionHistory, "groq");
  const prompt = buildEvaluatorPrompt(state, trimmedHistory);

  if (isQuestion) {
    // Still call the model — it may have useful feedback — but pre-inject the signal
    logger.info(
      { interviewId: state.interviewId },
      "[graph] evaluator — answer appears to be a question",
    );
    const result = await callEvaluateWithFallback(prompt, state.interviewId);
    const signals: DetectionSignal[] = Array.from(
      new Set<DetectionSignal>([...result.detectionSignals, "incomplete"]),
    );
    return { evaluationResult: { ...result, detectionSignals: signals } };
  }

  const result = await callEvaluateWithFallback(prompt, state.interviewId);
  logger.info(
    { interviewId: state.interviewId, score: result.score, signals: result.detectionSignals },
    "[graph] evaluator — answer scored",
  );
  return { evaluationResult: result };
}

// ── Conditional edge: after router ───────────────────────────────────────────

function routerEdge(state: InterviewGraphState): "interviewer" | "evaluator" | typeof END {
  if (state.routingDecision === "interviewer") return "interviewer";
  if (state.routingDecision === "evaluator") return "evaluator";
  return END;
}

// ── Graph assembly ────────────────────────────────────────────────────────────

const checkpointer = new MemorySaver();

const graph = new StateGraph(InterviewGraphAnnotation)
  .addNode("router", routerNode)
  .addNode("interviewer", interviewerNode)
  .addNode("evaluator", evaluatorNode)
  .addEdge(START, "router")
  .addConditionalEdges("router", routerEdge, ["interviewer", "evaluator", END])
  .addEdge("interviewer", END)
  .addEdge("evaluator", END);

/** Compiled graph — invoke via interviewGraph.invoke(state, { configurable: { thread_id } }) */
export const interviewGraph = graph.compile({ checkpointer });
