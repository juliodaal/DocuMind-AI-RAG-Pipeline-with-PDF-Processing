import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  console.log("Checking storage bucket 'documents'...\n");

  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) throw new Error(bErr.message);
  const docs = buckets.find((b) => b.id === "documents");
  if (!docs) {
    console.error("❌ Bucket 'documents' not found");
    process.exit(1);
  }
  console.log(
    `✅ Bucket exists: id=${docs.id}, public=${docs.public}, fileSizeLimit=${docs.file_size_limit}, allowedMimeTypes=${JSON.stringify(docs.allowed_mime_types)}`,
  );
  if (docs.public) {
    console.error("❌ Bucket should be PRIVATE");
    process.exit(1);
  }

  // Round-trip: signed upload URL + actual upload + download + delete
  const testKey = `__check__/test-${Date.now()}.pdf`;
  console.log(`\nSigning upload URL for ${testKey}...`);
  const { data: signed, error: sErr } = await admin.storage
    .from("documents")
    .createSignedUploadUrl(testKey);
  if (sErr) throw new Error(`Sign failed: ${sErr.message}`);
  console.log(`✅ Signed URL: ${signed.signedUrl.slice(0, 80)}...`);

  const fakeBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
  const putRes = await fetch(signed.signedUrl, {
    method: "PUT",
    body: fakeBytes,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!putRes.ok) {
    throw new Error(`PUT failed: ${putRes.status} ${await putRes.text()}`);
  }
  console.log("✅ PUT upload succeeded");

  const { data: dl, error: dlErr } = await admin.storage.from("documents").download(testKey);
  if (dlErr) throw new Error(`Download failed: ${dlErr.message}`);
  const buf = new Uint8Array(await dl.arrayBuffer());
  if (buf[0] !== 0x25 || buf[1] !== 0x50) throw new Error("Downloaded bytes don't match");
  console.log(`✅ Downloaded ${buf.length} bytes, content matches`);

  const { error: rmErr } = await admin.storage.from("documents").remove([testKey]);
  if (rmErr) throw new Error(`Cleanup failed: ${rmErr.message}`);
  console.log("✅ Cleanup: test object removed");

  console.log("\n🎉 Supabase Storage bucket fully operational.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
