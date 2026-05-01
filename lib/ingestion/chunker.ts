import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { encodingForModel, type Tiktoken } from "js-tiktoken";
import type { ParsedPage } from "./parser";

export type Chunk = {
  index: number;
  content: string;
  pageNumber: number;
  tokenCount: number;
};

const CHUNK_TOKENS = 800;
const CHUNK_OVERLAP_TOKENS = 120;

let _encoder: Tiktoken | null = null;
function getEncoder(): Tiktoken {
  // gpt-4o-mini uses the o200k_base encoding (same family as gpt-4o).
  if (!_encoder) {
    try {
      _encoder = encodingForModel("gpt-4o-mini");
    } catch {
      _encoder = encodingForModel("gpt-4o");
    }
  }
  return _encoder;
}

export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

/**
 * Split a parsed PDF into chunks suitable for embedding.
 * Strategy: per-page splitting so each chunk maps to exactly one page_number.
 * (Cross-page chunks would lose the page mapping for citations.)
 */
export async function chunkPages(pages: ParsedPage[]): Promise<Chunk[]> {
  const enc = getEncoder();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_TOKENS,
    chunkOverlap: CHUNK_OVERLAP_TOKENS,
    separators: ["\n\n", "\n", ". ", " ", ""],
    lengthFunction: (text: string) => enc.encode(text).length,
  });

  const chunks: Chunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    if (!page.text.trim()) continue;
    const pieces = await splitter.splitText(page.text);
    for (const piece of pieces) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      chunks.push({
        index: globalIndex++,
        content: trimmed,
        pageNumber: page.number,
        tokenCount: countTokens(trimmed),
      });
    }
  }

  return chunks;
}
