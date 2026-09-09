// ── AI Provider Registry ──────────────────────────────────────────────────────
// The model abstraction layer. Nodes call callGenerateWithFallback /
// callEvaluateWithFallback — never a vendor SDK directly.
//
// Adding a new provider: implement ModelProvider, add to PROVIDERS array.
// No call sites change.
//
// Failure handling: 429, timeout, malformed response, and hard outage are all
// treated identically — retry with backoff, then cycle to the next provider.
// A 429 is NOT a special case.

import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { PROVIDER_CONTEXT_WINDOWS } from "./context.manager.js";
import type { GenerateQuestionInput, GeneratedQuestion, AiEvaluateResult } from "./ai.types.js";
import type { InterviewerPromptResult, EvaluatorPromptResult } from "./prompts.js";

// ── Retry config ──────────────────────────────────────────────────────────────

const MAX_RETRIES_PER_PROVIDER = 2;
const BASE_BACKOFF_MS = 300; // doubles each retry: 300 → 600
const CALL_TIMEOUT_MS = 8_000;

// ── Model provider interface ──────────────────────────────────────────────────
// Nodes call this interface — never a vendor SDK directly.
// Adding a new provider requires only implementing this interface and appending
// to the PROVIDERS array.

export interface ModelProvider {
  name: string;
  contextWindowTokens: number;
  isReady: () => boolean;
  generateQuestion: (
    prompt: InterviewerPromptResult,
    input: GenerateQuestionInput,
  ) => Promise<GeneratedQuestion>;
  evaluateAnswer: (prompt: EvaluatorPromptResult) => Promise<AiEvaluateResult>;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    sleep(ms).then((): never => {
      throw new Error("PROVIDER_TIMEOUT");
    }),
  ]);
}

function parseJsonResponse<T>(raw: string): T {
  // Strip markdown code fences if the model wraps the JSON
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

// ── Stub provider ─────────────────────────────────────────────────────────────

const STUB_QUESTIONS: Record<
  "BEHAVIORAL" | "TECHNICAL" | "MIXED",
  { title: string; description: string | null }[]
> = {
  BEHAVIORAL: [
    {
      title: "Tell me about a time you handled a conflict within your team.",
      description: "Focus on the situation, your actions, and the outcome.",
    },
    {
      title: "Describe a project where you had to meet a tight deadline.",
      description: "Walk through how you prioritised and what trade-offs you made.",
    },
    {
      title: "Give an example of a time you had to adapt quickly to change.",
      description: "What triggered the change and how did you respond?",
    },
  ],
  TECHNICAL: [
    {
      title: "Explain the difference between a process and a thread.",
      description: "Cover memory isolation, scheduling, and when you'd choose one over the other.",
    },
    {
      title: "How would you design a URL shortener?",
      description: "Consider storage, collision handling, and read/write throughput.",
    },
    {
      title: "What is the CAP theorem and how does it affect database selection?",
      description: "Give a concrete example of a trade-off you'd make.",
    },
  ],
  MIXED: [
    {
      title:
        "Describe a technically challenging problem you solved and how you communicated it to non-technical stakeholders.",
      description: null,
    },
    {
      title: "How do you balance technical debt against feature delivery?",
      description: "Give a concrete example from your experience.",
    },
    {
      title: "Walk me through a time you had to make a decision with incomplete information.",
      description: "What was the outcome and what would you do differently?",
    },
  ],
};

const stubProvider: ModelProvider = {
  name: "stub",
  contextWindowTokens: PROVIDER_CONTEXT_WINDOWS.stub!,
  isReady: () => true,
  generateQuestion: async (_, input) => {
    const pool = STUB_QUESTIONS[input.config.interviewType] ?? STUB_QUESTIONS.MIXED;
    const entry = pool[(input.sequenceNumber - 1) % pool.length]!;
    return {
      questionTitle: entry.title,
      questionDescription: entry.description,
      questionType: input.config.interviewType,
    };
  },
  evaluateAnswer: async (_prompt) => ({
    score: 50,
    correctness: 50,
    relevance: 50,
    clarity: 50,
    technicalDepth: 50,
    feedback: "Stub evaluation — AI evaluator not yet active.",
    strengths: [],
    weaknesses: [],
    detectionSignals: ["none"],
  }),
};

// ── Groq provider ─────────────────────────────────────────────────────────────

const groqProvider: ModelProvider = {
  name: "groq",
  contextWindowTokens: PROVIDER_CONTEXT_WINDOWS.groq!,
  isReady: () => !!env.GROQ_API_KEY,
  generateQuestion: async (prompt, input) => {
    const { default: Groq } = await import("groq-sdk");
    const client = new Groq({ apiKey: env.GROQ_API_KEY });
    const res = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 512,
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = parseJsonResponse<{
      questionTitle?: string;
      questionDescription?: string | null;
      questionType?: string;
    }>(raw);
    if (!parsed.questionTitle) throw new Error("MALFORMED_RESPONSE");
    return {
      questionTitle: parsed.questionTitle,
      questionDescription: parsed.questionDescription ?? null,
      questionType:
        (parsed.questionType as GeneratedQuestion["questionType"]) ?? input.config.interviewType,
    };
  },
  evaluateAnswer: async (prompt) => {
    const { default: Groq } = await import("groq-sdk");
    const client = new Groq({ apiKey: env.GROQ_API_KEY });
    const res = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content ?? "";
    return parseAndValidateEvaluation(raw);
  },
};

// ── Mistral provider ──────────────────────────────────────────────────────────

const mistralProvider: ModelProvider = {
  name: "mistral",
  contextWindowTokens: PROVIDER_CONTEXT_WINDOWS.mistral!,
  isReady: () => !!env.MISTRAL_API_KEY,
  generateQuestion: async (prompt, input) => {
    const { Mistral } = await import("@mistralai/mistralai");
    const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
    const res = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 512,
      responseFormat: { type: "json_object" },
    });
    const raw = res.choices?.[0]?.message?.content ?? "";
    const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = parseJsonResponse<{
      questionTitle?: string;
      questionDescription?: string | null;
      questionType?: string;
    }>(rawStr);
    if (!parsed.questionTitle) throw new Error("MALFORMED_RESPONSE");
    return {
      questionTitle: parsed.questionTitle,
      questionDescription: parsed.questionDescription ?? null,
      questionType:
        (parsed.questionType as GeneratedQuestion["questionType"]) ?? input.config.interviewType,
    };
  },
  evaluateAnswer: async (prompt) => {
    const { Mistral } = await import("@mistralai/mistralai");
    const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
    const res = await client.chat.complete({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 1024,
      responseFormat: { type: "json_object" },
    });
    const raw = res.choices?.[0]?.message?.content ?? "";
    const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw);
    return parseAndValidateEvaluation(rawStr);
  },
};

// ── Evaluation response parser + validator ────────────────────────────────────

import type { DetectionSignal } from "./graph.state.js";

const VALID_SIGNALS = new Set<DetectionSignal>([
  "strong",
  "weak",
  "vague",
  "incomplete",
  "off_topic",
  "none",
]);

function parseAndValidateEvaluation(raw: string): AiEvaluateResult {
  const parsed = parseJsonResponse<Record<string, unknown>>(raw);

  const clamp = (v: unknown): number => Math.min(100, Math.max(0, Number(v) || 0));
  const signals: DetectionSignal[] = Array.isArray(parsed.detectionSignals)
    ? (parsed.detectionSignals as unknown[]).filter((s): s is DetectionSignal =>
        VALID_SIGNALS.has(s as DetectionSignal),
      )
    : ["none"];

  return {
    score: clamp(parsed.score),
    correctness: clamp(parsed.correctness),
    relevance: clamp(parsed.relevance),
    clarity: clamp(parsed.clarity),
    technicalDepth: clamp(parsed.technicalDepth),
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "No feedback provided.",
    strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]) : [],
    detectionSignals: signals.length > 0 ? signals : ["none"],
  };
}

// ── Ordered provider chain ────────────────────────────────────────────────────
// Stub is always last — guarantees the chain never fully empties.

const PROVIDERS: ModelProvider[] = [groqProvider, mistralProvider, stubProvider];

// ── Fallback question — returned when every provider + retry is exhausted ─────

function fallbackQuestion(input: GenerateQuestionInput): GeneratedQuestion {
  return {
    questionTitle:
      "We're having trouble generating a question right now. Please describe a recent technical challenge you faced.",
    questionDescription: "Take your time — this is a general prompt while we recover.",
    questionType: input.config.interviewType,
  };
}

function fallbackEvaluation(): AiEvaluateResult {
  return {
    score: 0,
    correctness: 0,
    relevance: 0,
    clarity: 0,
    technicalDepth: 0,
    feedback: "Evaluation unavailable — all AI providers failed. This answer has been recorded.",
    strengths: [],
    weaknesses: [],
    detectionSignals: ["none"],
  };
}

// ── Core fallback loop ────────────────────────────────────────────────────────

async function runWithFallback<T>(
  operation: (provider: ModelProvider) => Promise<T>,
  fallback: () => T,
  interviewId: string,
  opName: string,
): Promise<T> {
  const ready = PROVIDERS.filter((p) => p.isReady());

  for (const provider of ready) {
    for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
      try {
        return await withTimeout(operation(provider), CALL_TIMEOUT_MS);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        logger.warn(
          { provider: provider.name, attempt, reason, interviewId, op: opName },
          "[ai] provider attempt failed",
        );
        if (attempt < MAX_RETRIES_PER_PROVIDER) {
          await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
        }
      }
    }
    logger.warn(
      { provider: provider.name, interviewId, op: opName },
      "[ai] provider exhausted — cycling to next",
    );
  }

  logger.error({ interviewId, op: opName }, "[ai] all providers exhausted — returning fallback");
  return fallback();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function callGenerateWithFallback(
  prompt: InterviewerPromptResult,
  input: GenerateQuestionInput,
): Promise<GeneratedQuestion> {
  return runWithFallback(
    (p) => p.generateQuestion(prompt, input),
    () => fallbackQuestion(input),
    input.interviewId,
    "generate",
  );
}

export async function callEvaluateWithFallback(
  prompt: EvaluatorPromptResult,
  interviewId: string,
): Promise<AiEvaluateResult> {
  return runWithFallback(
    (p) => p.evaluateAnswer(prompt),
    fallbackEvaluation,
    interviewId,
    "evaluate",
  );
}

// ── Legacy export — kept for question.generator.ts compatibility ──────────────
// question.generator.ts calls callWithFallback; redirect to the new API.

export async function callWithFallback(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
  // Build a minimal prompt for the stub path (no state context available here)
  const minimalPrompt: InterviewerPromptResult = {
    systemPrompt: `Generate a ${input.config.interviewType} interview question.`,
    userPrompt: `Question ${input.sequenceNumber} for a ${input.config.difficulty} interview.`,
    avoidTitles: input.previousQuestions.map((q) => q.questionTitle),
  };
  return callGenerateWithFallback(minimalPrompt, input);
}

// Re-export provider list for tests
export { PROVIDERS };
