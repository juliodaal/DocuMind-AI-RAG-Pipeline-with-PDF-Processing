/**
 * E2E test of the ingestion pipeline:
 * 1. Create test user + org (trigger creates org automatically)
 * 2. Generate a multi-page PDF with realistic text
 * 3. Upload to Supabase Storage at the org-scoped path
 * 4. Insert documents row + run ingestDocument()
 * 5. Verify chunks + embeddings + status='ready'
 * 6. Cleanup
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
  "DocuMind AI is a multi-tenant retrieval-augmented generation platform. Each workspace is isolated using Postgres Row Level Security so one tenant cannot read another tenant's documents.",
  "The ingestion pipeline downloads PDFs from Supabase Storage, parses them with unpdf, splits the text into chunks of roughly 800 tokens with 120 token overlap, and computes embeddings with OpenAI text-embedding-3-small.",
  "Hybrid search combines dense vector similarity with sparse BM25 full-text ranking. Reciprocal Rank Fusion merges both result lists, producing a final ranking that beats either approach alone.",
  "Citations are emitted inline as bracketed numbers like [1] [2]. The frontend parses these and renders interactive cards that open a panel with the source chunk and the original document page.",
  "Cost tracking is enforced per workspace through the usage_events table. Every embedding call, chat completion, and rerank request inserts a row with model name, token counts, and the dollar cost in cents.",
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
  let current = "";
  for (const w of words) {
    if ((current + " " + w).length > width) {
      lines.push(current);
      current = w;
    } else {
      current = current ? current + " " + w : w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function main() {
  // Dynamic imports — must happen after loadEnvConfig
  const { ingestDocument } = await import("../lib/ingestion/pipeline");
  const { documentKey } = await import("../lib/storage/keys");

  console.log("1. Creating test user + org...");
  const email = `ingest-check-${Date.now()}@example.test`;
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: "Test1234!password",
    email_confirm: true,
    user_metadata: { full_name: "Ingest Tester" },
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
  console.log(`   user=${userId.slice(0, 8)} org=${org.id.slice(0, 8)}`);

  console.log("\n2. Generating test PDF (5 pages)...");
  const pdfBytes = await generatePdf();
  console.log(`   ${pdfBytes.length} bytes`);

  console.log("\n3. Inserting document row + uploading to Storage...");
  const { data: doc, error: dErr } = await admin
    .from("documents")
    .insert({
      org_id: org.id,
      uploader_id: userId,
      filename: "test.pdf",
      mime_type: "application/pdf",
      storage_path: "", // will set below
      size_bytes: pdfBytes.length,
      status: "queued",
    })
    .select()
    .single();
  if (dErr || !doc) throw new Error(`insert document: ${dErr?.message}`);
  const path = documentKey(org.id, doc.id, "test.pdf");
  await admin.from("documents").update({ storage_path: path }).eq("id", doc.id);

  const { error: upErr } = await admin.storage
    .from("documents")
    .upload(path, pdfBytes, { contentType: "application/pdf" });
  if (upErr) throw new Error(`upload: ${upErr.message}`);
  console.log(`   uploaded to ${path}`);

  console.log("\n4. Running ingestion pipeline...");
  const t0 = Date.now();
  const result = await ingestDocument(doc.id);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `   ✅ pages=${result.pageCount} chunks=${result.chunkCount} tokens=${result.embeddingTokens} (${elapsed}s)`,
  );

  console.log("\n5. Verifying chunks + embeddings...");
  const { data: chunks, error: cErr } = await admin
    .from("document_chunks")
    .select("id, chunk_index, content, page_number, token_count, embedding")
    .eq("document_id", doc.id)
    .order("chunk_index");
  if (cErr || !chunks) throw new Error(`fetch chunks: ${cErr?.message}`);

  console.log(`   ✅ ${chunks.length} chunks in DB`);
  const withEmbedding = chunks.filter((c) => c.embedding != null);
  console.log(`   ✅ ${withEmbedding.length}/${chunks.length} have embeddings`);
  if (withEmbedding.length !== chunks.length) {
    throw new Error("Some chunks missing embeddings");
  }

  // Sample a chunk
  const first = chunks[0];
  if (first) {
    console.log(`   First chunk preview: page=${first.page_number} tokens=${first.token_count}`);
    console.log(`   "${first.content.slice(0, 80)}..."`);
  }

  // Verify document status
  const { data: finalDoc } = await admin
    .from("documents")
    .select("status, page_count, processed_at, error")
    .eq("id", doc.id)
    .single();
  console.log(`   ✅ document.status=${finalDoc?.status} page_count=${finalDoc?.page_count}`);
  if (finalDoc?.status !== "ready") {
    throw new Error(`Expected status=ready, got ${finalDoc?.status} (error: ${finalDoc?.error})`);
  }

  // Verify usage_events
  const { data: usage, error: uxErr } = await admin
    .from("usage_events")
    .select("kind, model, tokens_in, cost_cents")
    .eq("org_id", org.id);
  if (uxErr) throw new Error(`usage: ${uxErr.message}`);
  console.log(`   ✅ ${usage?.length ?? 0} usage_event(s):`);
  for (const u of usage ?? []) {
    console.log(
      `      ${u.kind} | ${u.model} | tokens=${u.tokens_in} | $${(Number(u.cost_cents) / 100).toFixed(6)}`,
    );
  }

  console.log("\n6. Cleanup...");
  const { error: dlErr } = await admin.auth.admin.deleteUser(userId);
  if (dlErr) console.warn(`⚠️  ${dlErr.message}`);
  else console.log("   ✅ Test user deleted (cascade removes everything)");

  // Storage cleanup (just in case)
  await admin.storage
    .from("documents")
    .remove([path])
    .catch(() => {});

  console.log("\n🎉 Ingestion pipeline works end-to-end.");
}

main().catch((e) => {
  console.error("\n❌ FAILED:", e);
  process.exit(1);
});
