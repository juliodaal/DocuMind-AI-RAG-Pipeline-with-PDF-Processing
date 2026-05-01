import OpenAI from "openai";
import { env } from "@/lib/env";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

export const OPENAI_PRICING = {
  // USD per 1M tokens (as of 2026). Values used to compute cost_cents in usage_events.
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10.0 },
  "text-embedding-3-small": { input: 0.02, cachedInput: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, cachedInput: 0.13, output: 0 },
} as const;

export type KnownModel = keyof typeof OPENAI_PRICING;

/**
 * Compute cost in cents (USD) for a single LLM call.
 * Returns 0 for unknown models (logged later via usage_events.metadata).
 */
export function computeCostCents(args: {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn?: number;
}): number {
  const pricing = OPENAI_PRICING[args.model as KnownModel];
  if (!pricing) return 0;

  const cachedIn = args.cachedTokensIn ?? 0;
  const uncachedIn = Math.max(0, args.tokensIn - cachedIn);

  const usd =
    (uncachedIn / 1_000_000) * pricing.input +
    (cachedIn / 1_000_000) * pricing.cachedInput +
    (args.tokensOut / 1_000_000) * pricing.output;

  // Convert USD to cents and round to 4 decimal places (numeric(10,4) column).
  // 4 decimals of cents lets us track sub-cent operations like single embeddings.
  const cents = usd * 100;
  return Math.round(cents * 10000) / 10000;
}
