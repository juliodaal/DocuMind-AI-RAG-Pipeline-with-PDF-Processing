import { createAdminClient } from "@/lib/auth/admin";
import { downloadObject } from "@/lib/storage/supabase";
import { parsePdf } from "@/lib/ingestion/parser";
import { chunkPages } from "@/lib/ingestion/chunker";
import { embedTexts } from "@/lib/ingestion/embedder";
import { updateDocumentStatus } from "@/lib/db/queries/documents";
import { recordUsage } from "@/lib/llm/usage";
import { env } from "@/lib/env";
import type { Document } from "@/lib/db/types";

export type IngestResult = {
  documentId: string;
  pageCount: number;
  chunkCount: number;
  embeddingTokens: number;
};

/**
 * Full ingestion pipeline. Idempotent w.r.t. chunks (deletes existing chunks
 * before inserting) so a retry recovers cleanly.
 */
export async function ingestDocument(documentId: string): Promise<IngestResult> {
  const admin = createAdminClient();

  // 1. Load document row
  const { data: doc, error: docErr } = await admin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (docErr || !doc) throw new Error(`Document not found: ${documentId}`);
  const document = doc as Document;

  await updateDocumentStatus(documentId, { status: "processing", error: null });

  try {
    // 2. Download from Storage
    const blob = await downloadObject(document.storage_path);
    const buffer = new Uint8Array(await blob.arrayBuffer());

    // 3. Parse PDF
    const { pages, totalPages } = await parsePdf(buffer);

    // 4. Chunk
    const chunks = await chunkPages(pages);
    if (chunks.length === 0) {
      throw new Error("PDF has no extractable text");
    }

    // 5. Embed (in batches, bounded concurrency)
    const { embeddings, totalTokens } = await embedTexts(chunks.map((c) => c.content));

    await recordUsage({
      orgId: document.org_id,
      userId: document.uploader_id,
      kind: "embedding",
      model: env.OPENAI_EMBEDDING_MODEL,
      tokensIn: totalTokens,
      metadata: { document_id: documentId, chunk_count: chunks.length },
    });

    // 6. Upsert chunks (idempotent: delete then insert)
    const { error: delErr } = await admin
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId);
    if (delErr) throw new Error(`Failed to clear existing chunks: ${delErr.message}`);

    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      org_id: document.org_id,
      chunk_index: c.index,
      content: c.content,
      embedding: embeddings[i] as unknown as string,
      page_number: c.pageNumber,
      token_count: c.tokenCount,
      metadata: {},
    }));

    // Insert in chunks of 200 to stay under PostgREST payload limits
    const INSERT_BATCH = 200;
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const slice = rows.slice(i, i + INSERT_BATCH);
      const { error: insErr } = await admin.from("document_chunks").insert(slice);
      if (insErr) throw new Error(`Chunk insert failed: ${insErr.message}`);
    }

    // 7. Mark ready
    await updateDocumentStatus(documentId, {
      status: "ready",
      page_count: totalPages,
      processed_at: new Date().toISOString(),
      error: null,
    });

    return {
      documentId,
      pageCount: totalPages,
      chunkCount: chunks.length,
      embeddingTokens: totalTokens,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateDocumentStatus(documentId, { status: "failed", error: message });
    throw err;
  }
}
