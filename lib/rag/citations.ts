import type { RetrievedChunk } from "./retriever";

export type Citation = {
  /** 1-indexed marker number that appears in the assistant text. */
  number: number;
  chunkId: string;
  documentId: string;
  documentFilename: string;
  pageNumber: number | null;
  /** Snippet (~200 chars) of the chunk for the citation card preview. */
  preview: string;
};

const CITATION_PATTERN = /\[(\d+)\]/g;

/**
 * Parse [1], [2], ... markers out of an assistant message and resolve them
 * against the ordered chunk list that was sent in the prompt context.
 *
 * Only returns citations that:
 *   - actually appear in the text
 *   - match a valid chunk number (1..ordered.length)
 *   - are unique by chunk id (deduped)
 */
export function extractCitations(text: string, ordered: RetrievedChunk[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const match of text.matchAll(CITATION_PATTERN)) {
    const raw = match[1];
    if (!raw) continue;
    const n = parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 1 || n > ordered.length) continue;
    const chunk = ordered[n - 1];
    if (!chunk) continue;
    if (seen.has(chunk.chunkId)) continue;
    seen.add(chunk.chunkId);
    citations.push({
      number: n,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentFilename: chunk.documentFilename,
      pageNumber: chunk.pageNumber,
      preview: chunk.content.slice(0, 240),
    });
  }

  return citations.sort((a, b) => a.number - b.number);
}
