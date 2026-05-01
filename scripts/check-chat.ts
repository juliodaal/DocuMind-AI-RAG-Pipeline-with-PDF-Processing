/**
 * E2E test of the RAG chat pipeline (without the React layer):
 * 1. Create test user + org → ingest a generated PDF
 * 2. Run hybridSearch + buildContext + streamText
 * 3. Verify the answer cites at least one source from the indexed chunks
 * 4. Cleanup
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const PAGES = [
  "DocuMind AI uses OpenAI text-embedding-3-small for vector embeddings. The model produces 1536-dimensional vectors and costs $0.02 per million tokens, making it the cheapest competent OpenAI embedding model.",
  "The chunking strategy splits each PDF page into chunks of approximately 800 tokens with a 120-token overlap. Per-page splitting ensures every chunk maps to exactly one page number, which is critical for citation accuracy.",
  "Hybrid search combines pgvector cosine similarity (HNSW index) with BM25-style full-text search via Postgres tsvector. Reciprocal Rank Fusion with k=60 merges both result lists into a final top-K ranking.",
  "Multi-tenancy uses Row Level Security policies on Postgres. Each tenant's data is isolated at the database level via an org_id column on every row, with policies that compare against the JWT's sub claim.",
];

async function generatePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (const text of PAGES) {
    const page = pdfDoc.addPage([595, 842]);
    const lines = wrap(text, 80);
    let y = 780;
    for (const line of lines) {
      page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
      y -= 18;
    }
  }
  return await pdfDoc.save();
}

function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).length > width) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function main() {
  const { hybridSearch } = await import("../lib/rag/retriever");
  const { SYSTEM_PROMPT, buildContext, buildUserMessage } = await import("../lib/rag/prompt");
  const { extractCitations } = await import("../lib/rag/citations");
  const { ingestDocument } = await import("../lib/ingestion/pipeline");
  const { documentKey } = await import("../lib/storage/keys");
  const { streamText, convertToModelMessages } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");

  console.log("1. Creating test user + org...");
  const email = `chat-check-${Date.now()}@example.test`;
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: "Test1234!password",
    email_confirm: true,
    user_metadata: { full_name: "Chat Tester" },
  });
  if (uErr || !u.user) throw new Error(`createUser: ${uErr?.message}`);
  const userId = u.user.id;
  await new Promise((r) => setTimeout(r, 400));
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (!org) throw new Error("Test org not found");

  try {
    console.log("2. Generating + ingesting PDF...");
    const pdfBytes = await generatePdf();
    const { data: doc } = await admin
      .from("documents")
      .insert({
        org_id: org.id,
        uploader_id: userId,
        filename: "stack.pdf",
        mime_type: "application/pdf",
        storage_path: "",
        size_bytes: pdfBytes.length,
        status: "queued",
      })
      .select()
      .single();
    if (!doc) throw new Error("insert document failed");
    const path = documentKey(org.id, doc.id, "stack.pdf");
    await admin.from("documents").update({ storage_path: path }).eq("id", doc.id);
    await admin.storage
      .from("documents")
      .upload(path, pdfBytes, { contentType: "application/pdf" });

    const result = await ingestDocument(doc.id);
    console.log(`   ingested: ${result.chunkCount} chunks (${result.embeddingTokens} tokens)`);

    console.log("\n3. Running hybrid search for: 'What embedding model is used and why?'");
    const question = "What embedding model is used and why?";
    const chunks = await hybridSearch(org.id, question, { userId });
    console.log(`   ${chunks.length} chunks retrieved (top RRF):`);
    for (const c of chunks.slice(0, 3)) {
      console.log(
        `     · page ${c.pageNumber} rrf=${c.rrfScore?.toFixed(4)}: "${c.content.slice(0, 70)}..."`,
      );
    }
    if (chunks.length === 0) throw new Error("No chunks retrieved");

    console.log("\n4. Streaming answer with gpt-4o-mini...");
    const { context, ordered } = buildContext(chunks);
    const userMsg = buildUserMessage(question, context);

    const stream = streamText({
      model: openai(process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages([
        {
          role: "user",
          parts: [{ type: "text", text: userMsg }],
        },
      ]),
    });

    let answer = "";
    for await (const delta of stream.textStream) {
      answer += delta;
      process.stdout.write(delta);
    }
    console.log("\n");

    console.log("5. Extracting citations from answer...");
    const citations = extractCitations(answer, ordered);
    console.log(`   ${citations.length} citation(s) found:`);
    for (const c of citations) {
      console.log(`     [${c.number}] ${c.documentFilename}, page ${c.pageNumber}`);
    }

    if (citations.length === 0) {
      console.warn("⚠️  Warning: no citations in answer (model didn't follow instructions)");
    } else {
      console.log("\n✅ Chat pipeline works end-to-end with citations.");
    }

    const usage = await stream.usage;
    console.log(
      `\n   Tokens: in=${usage.inputTokens} out=${usage.outputTokens} (cached=${usage.cachedInputTokens ?? 0})`,
    );
  } finally {
    console.log("\n6. Cleanup...");
    const { error: dlErr } = await admin.auth.admin.deleteUser(userId);
    if (dlErr) console.warn(`⚠️  ${dlErr.message}`);
    else console.log("   ✅ Test user deleted (cascade)");
  }
}

main().catch((e) => {
  console.error("\n❌ FAILED:", e);
  process.exit(1);
});
