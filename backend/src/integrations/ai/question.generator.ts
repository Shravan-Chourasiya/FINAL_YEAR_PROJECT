// ── Question Generator ────────────────────────────────────────────────────────
// Public entry point for question generation. All calls go through
// callWithFallback, which handles retry-with-backoff, provider cycling,
// and the final fallback question — so callers never need to handle
// generation failures themselves.

import type { GenerateQuestionInput, GeneratedQuestion } from "./ai.types.js";
import { callWithFallback } from "./provider.js";

export async function generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
  return callWithFallback(input);
}
