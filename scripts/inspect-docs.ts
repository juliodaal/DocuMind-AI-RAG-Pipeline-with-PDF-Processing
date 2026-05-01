import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  const { data: docs, error } = await admin
    .from("documents")
    .select("id, filename, status, page_count, error, created_at, processed_at, org_id")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  console.log(`Found ${docs?.length ?? 0} document(s):\n`);
  for (const d of docs ?? []) {
    console.log(`📄 ${d.filename}`);
    console.log(`   id:           ${d.id}`);
    console.log(`   status:       ${d.status}`);
    console.log(`   page_count:   ${d.page_count ?? "(null)"}`);
    console.log(`   processed_at: ${d.processed_at ?? "(null)"}`);
    console.log(`   error:        ${d.error ?? "(none)"}`);
    console.log(`   org_id:       ${d.org_id}`);

    const { count } = await admin
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", d.id);
    const { count: withEmb } = await admin
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", d.id)
      .not("embedding", "is", null);
    console.log(`   chunks:       ${count} (${withEmb} with embeddings)`);
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
