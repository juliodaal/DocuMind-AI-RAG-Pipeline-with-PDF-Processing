import { createAdminClient } from "@/lib/auth/admin";
import { getOpenAI } from "@/lib/llm/openai";
import { recordUsage } from "@/lib/llm/usage";
import { env } from "@/lib/env";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  /** Score from the source retriever — meaning depends on `source`. */
  score: number;
  /** Set after RRF fusion. */
  rrfScore?: number;
  source: "vector" | "fulltext" | "hybrid";
};

const VECTOR_K = 20;
const FULLTEXT_K = 20;
const RRF_K = 60; // Reciprocal Rank Fusion smoothing constant
const FINAL_K = 8;

/**
 * Embed a query and run vector similarity search against the org's chunks.
 */
export async function vectorSearch(
  orgId: string,
  query: string,
  limit = VECTOR_K,
  options: { recordUsage?: { userId?: string | null } } = {},
): Promise<RetrievedChunk[]> {
  const openai = getOpenAI();
  const embedRes = await openai.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: query,
  });
  const embedding = embedRes.data[0]?.embedding;
  if (!embedding) throw new Error("Failed to embed query");

  if (options.recordUsage) {
    void recordUsage({
      orgId,
      userId: options.recordUsage.userId,
      kind: "embedding",
      model: env.OPENAI_EMBEDDING_MODEL,
      tokensIn: embedRes.usage?.total_tokens ?? 0,
      metadata: { feature: "query_embed" },
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("vector_search", {
    query_embedding: embedding as unknown as string,
    match_org_id: orgId,
    match_count: limit,
  });
  if (error) throw new Error(`vector_search RPC: ${error.message}`);

  return (
    (data ?? []) as Array<{
      chunk_id: string;
      document_id: string;
      document_filename: string;
      chunk_index: number;
      content: string;
      page_number: number | null;
      similarity: number;
    }>
  ).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentFilename: row.document_filename,
    chunkIndex: row.chunk_index,
    content: row.content,
    pageNumber: row.page_number,
    score: row.similarity,
    source: "vector" as const,
  }));
}

/**
 * Run BM25-like full-text search against the org's chunks.
 */
export async function fulltextSearch(
  orgId: string,
  query: string,
  limit = FULLTEXT_K,
): Promise<RetrievedChunk[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fulltext_search", {
    query_text: query,
    match_org_id: orgId,
    match_count: limit,
  });
  if (error) throw new Error(`fulltext_search RPC: ${error.message}`);

  return (
    (data ?? []) as Array<{
      chunk_id: string;
      document_id: string;
      document_filename: string;
      chunk_index: number;
      content: string;
      page_number: number | null;
      rank: number;
    }>
  ).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentFilename: row.document_filename,
    chunkIndex: row.chunk_index,
    content: row.content,
    pageNumber: row.page_number,
    score: row.rank,
    source: "fulltext" as const,
  }));
}

/**
 * Hybrid search = vector + fulltext fused via Reciprocal Rank Fusion.
 * RRF score = sum_over_lists(1 / (k + rank)).
 * Returns top FINAL_K deduplicated chunks ordered by RRF score.
 */
export async function hybridSearch(
  orgId: string,
  query: string,
  options: { userId?: string | null; finalK?: number } = {},
): Promise<RetrievedChunk[]> {
  const finalK = options.finalK ?? FINAL_K;

  const [vectorHits, fulltextHits] = await Promise.all([
    vectorSearch(orgId, query, VECTOR_K, {
      recordUsage: { userId: options.userId ?? null },
    }),
    fulltextSearch(orgId, query, FULLTEXT_K),
  ]);

  const fused = new Map<string, RetrievedChunk & { rrfScore: number }>();

  for (const [rank0, hit] of vectorHits.entries()) {
    const rank = rank0 + 1;
    const contribution = 1 / (RRF_K + rank);
    const existing = fused.get(hit.chunkId);
    if (existing) {
      existing.rrfScore += contribution;
    } else {
      fused.set(hit.chunkId, { ...hit, source: "hybrid", rrfScore: contribution });
    }
  }

  for (const [rank0, hit] of fulltextHits.entries()) {
    const rank = rank0 + 1;
    const contribution = 1 / (RRF_K + rank);
    const existing = fused.get(hit.chunkId);
    if (existing) {
      existing.rrfScore += contribution;
    } else {
      fused.set(hit.chunkId, { ...hit, source: "hybrid", rrfScore: contribution });
    }
  }

  return Array.from(fused.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, finalK);
}

/**
 * Pure RRF fusion exposed for unit testing without DB access.
 */
export function rrfFuse(
  lists: { chunkId: string; rank: number }[][],
  options: { k?: number } = {},
): { chunkId: string; rrfScore: number }[] {
  const k = options.k ?? RRF_K;
  const fused = new Map<string, number>();
  for (const list of lists) {
    for (const { chunkId, rank } of list) {
      const contribution = 1 / (k + rank);
      fused.set(chunkId, (fused.get(chunkId) ?? 0) + contribution);
    }
  }
  return Array.from(fused.entries())
    .map(([chunkId, rrfScore]) => ({ chunkId, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore);
}
