// ── AI Module Public Interface ────────────────────────────────────────────────
// This is the ONLY file that modules/interview (or any other module) imports
// from the AI integration. Reaching past this into graph.ts, graph.state.ts,
// or provider.ts from outside src/integrations/ai/ is a contract violation.
//
// The four exported functions map 1:1 to the original Step 10 API surface:
//   startAiSession      ← POST /ai/session/start
//   generateNextQuestion ← POST /ai/question/next
//   evaluateAnswer      ← POST /ai/answer/evaluate
//   endAiSession        ← POST /ai/session/end
//
// All inputs are Zod-validated at this boundary before touching the graph.

import { randomUUID } from "crypto";
import { interviewGraph } from "./graph.js";
import {
  sessionInputToGraphState,
  nextQuestionInputToGraphState,
  evaluateInputToGraphState,
  graphStateToQuestionResult,
  graphStateToEvaluationResult,
} from "./graph.state.js";
import {
  aiSessionInputSchema,
  aiNextQuestionInputSchema,
  aiEvaluateInputSchema,
  aiEndSessionInputSchema,
} from "./ai.types.js";
import type {
  AiSessionInput,
  AiSessionResult,
  AiNextQuestionInput,
  AiNextQuestionResult,
  AiEvaluateInput,
  AiEvaluateResult,
  AiEndSessionInput,
} from "./ai.types.js";
import { logger } from "../../utils/logger.js";

// Re-export types so callers only need one import path
export type {
  AiSessionInput,
  AiSessionResult,
  AiNextQuestionInput,
  AiNextQuestionResult,
  AiEvaluateInput,
  AiEvaluateResult,
  AiEndSessionInput,
};

// ── startAiSession ────────────────────────────────────────────────────────────
// Initialises a new LangGraph thread for the interview. The returned threadId
// is stored in InterviewContext.aiContext.threadId and passed back on every
// subsequent call so the graph can resume the same checkpoint.

export async function startAiSession(raw: AiSessionInput): Promise<AiSessionResult> {
  const input = aiSessionInputSchema.parse(raw);
  const threadId = randomUUID();

  const initialState = sessionInputToGraphState(input, threadId);

  // Invoke the graph with operation="generate" so the first question is
  // pre-warmed into the thread's checkpoint state.
  await interviewGraph.invoke(initialState, {
    configurable: { thread_id: threadId },
  });

  logger.info({ interviewId: input.interviewId, threadId }, "[ai] session started");
  return { threadId };
}

// ── generateNextQuestion ──────────────────────────────────────────────────────
// Resumes the thread and runs Router → Interviewer to produce the next question.

export async function generateNextQuestion(
  raw: AiNextQuestionInput,
): Promise<AiNextQuestionResult> {
  const input = aiNextQuestionInputSchema.parse(raw);

  const turnState = nextQuestionInputToGraphState(input);

  const result = await interviewGraph.invoke(turnState, {
    configurable: { thread_id: input.threadId },
  });

  logger.info(
    { interviewId: input.interviewId, sequenceNumber: input.sequenceNumber },
    "[ai] question generated",
  );
  return graphStateToQuestionResult(result);
}

// ── evaluateAnswer ────────────────────────────────────────────────────────────
// Resumes the thread and runs Router → Evaluator to score the answer.
// NEVER called for timed-out answers (scored 0 without evaluation per spec).

export async function evaluateAnswer(raw: AiEvaluateInput): Promise<AiEvaluateResult> {
  const input = aiEvaluateInputSchema.parse(raw);

  const turnState = evaluateInputToGraphState(input);

  const result = await interviewGraph.invoke(turnState, {
    configurable: { thread_id: input.threadId },
  });

  logger.info(
    { interviewId: input.interviewId, questionId: input.questionId },
    "[ai] answer evaluated",
  );
  return graphStateToEvaluationResult(result);
}

// ── endAiSession ──────────────────────────────────────────────────────────────
// Signals the graph that the interview is over. Allows the graph to flush
// any pending LangSmith traces or cleanup. Fire-and-forget safe.

export async function endAiSession(raw: AiEndSessionInput): Promise<void> {
  const input = aiEndSessionInputSchema.parse(raw);

  await interviewGraph.invoke(
    {
      interviewId: input.interviewId,
      threadId: input.threadId,
      currentInput: { operation: "end", endReason: input.reason },
    },
    { configurable: { thread_id: input.threadId } },
  );

  logger.info({ interviewId: input.interviewId, reason: input.reason }, "[ai] session ended");
}
