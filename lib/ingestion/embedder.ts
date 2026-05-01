import pLimit from "p-limit";
import { getOpenAI } from "@/lib/llm/openai";
import { env } from "@/lib/env";

const BATCH_SIZE = 100;
const CONCURRENCY = 3;
const MAX_RETRIES = 3;

export type EmbedResult = {
  embeddings: number[][];
  totalTokens: number;
};

/**
 * Embed an array of texts in batches with bounded concurrency and exponential
 * backoff. Returns embeddings in input order + total token count for billing.
 */
export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  if (texts.length === 0) return { embeddings: [], totalTokens: 0 };

  const limit = pLimit(CONCURRENCY);
  const batches: { start: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push({ start: i, texts: texts.slice(i, i + BATCH_SIZE) });
  }

  const results: { start: number; vectors: number[][]; tokens: number }[] = await Promise.all(
    batches.map((b) =>
      limit(async () => {
        const { vectors, tokens } = await embedBatchWithRetry(b.texts);
        return { start: b.start, vectors, tokens };
      }),
    ),
  );

  // Reassemble in order
  const embeddings: number[][] = new Array(texts.length);
  let totalTokens = 0;
  for (const r of results) {
    for (let i = 0; i < r.vectors.length; i++) {
      embeddings[r.start + i] = r.vectors[i]!;
    }
    totalTokens += r.tokens;
  }

  return { embeddings, totalTokens };
}

async function embedBatchWithRetry(
  texts: string[],
): Promise<{ vectors: number[][]; tokens: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const openai = getOpenAI();
      const res = await openai.embeddings.create({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: texts,
      });
      return {
        vectors: res.data.map((d) => d.embedding),
        tokens: res.usage?.total_tokens ?? 0,
      };
    } catch (err) {
      lastError = err;
      const delay = 500 * Math.pow(2, attempt) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Embedding batch failed after ${MAX_RETRIES} attempts`);
}
