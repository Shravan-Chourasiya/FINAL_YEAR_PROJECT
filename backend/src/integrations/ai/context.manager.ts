// ── Context Manager ───────────────────────────────────────────────────────────
// Trims conversation history to fit within a provider's context window.
//
// Token estimation: 1 token ≈ 4 characters (rough but consistent across providers).
// Each provider declares its own contextWindowTokens limit so trimming is
// provider-aware — never assumes a single fixed limit.
//
// Strategy: keep the most recent entries. The first question is always kept
// (it anchors the interview topic). Entries are dropped from the middle when
// the window is exceeded.

import type { QuestionHistoryEntry } from "./ai.graph.types.js";

// ── Provider context window sizes (tokens) ────────────────────────────────────

export const PROVIDER_CONTEXT_WINDOWS: Record<string, number> = {
  groq: 8_192, // llama3-8b-8192 default
  mistral: 32_768, // mistral-small context
  stub: 32_768, // no real limit — generous cap
};

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function entryTokens(entry: QuestionHistoryEntry): number {
  return estimateTokens(
    `Q${entry.sequenceNumber}: ${entry.questionTitle} (${entry.questionType}, score: ${entry.score ?? "pending"})`,
  );
}

/**
 * Trim question history to fit within the provider's context window budget.
 * Always keeps the first entry (topic anchor) and the most recent entries.
 * The budget here is a fraction of the full window — the rest is reserved for
 * the system prompt, current question, and model output.
 */
export function trimHistory(
  history: QuestionHistoryEntry[],
  providerName: string,
  budgetFraction = 0.25, // use at most 25% of the context window for history
): QuestionHistoryEntry[] {
  if (history.length === 0) return [];

  const windowTokens = PROVIDER_CONTEXT_WINDOWS[providerName] ?? PROVIDER_CONTEXT_WINDOWS.stub!;
  const budget = Math.floor(windowTokens * budgetFraction);

  let total = 0;
  const kept: QuestionHistoryEntry[] = [];

  // Always include the most recent entries first (reverse order), then re-sort
  const reversed = [...history].reverse();
  for (const entry of reversed) {
    const cost = entryTokens(entry);
    if (total + cost > budget) break;
    kept.push(entry);
    total += cost;
  }

  // Re-sort by sequenceNumber ascending
  return kept.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}
