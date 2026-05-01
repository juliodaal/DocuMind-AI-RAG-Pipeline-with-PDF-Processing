import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const TEST_EMAIL = `trigger-check-${Date.now()}@example.test`;
const TEST_PASSWORD = "Test1234!password";
const TEST_NAME = "Trigger Tester";

async function main() {
  console.log(`Creating test user: ${TEST_EMAIL}`);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  });

  if (createErr || !created.user) {
    console.error("❌ createUser failed:", createErr?.message);
    process.exit(1);
  }
  const userId = created.user.id;
  console.log(`✅ User created: ${userId}\n`);

  // Wait briefly for trigger
  await new Promise((r) => setTimeout(r, 500));

  // Check profile
  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (pErr || !profile) {
    console.error("❌ profile NOT created by trigger:", pErr?.message);
    return cleanup(userId, 1);
  }
  console.log(`✅ profile created: email=${profile.email}, full_name=${profile.full_name}`);

  // Check org
  const { data: org, error: oErr } = await admin
    .from("organizations")
    .select("*")
    .eq("owner_id", userId)
    .single();
  if (oErr || !org) {
    console.error("❌ organization NOT created:", oErr?.message);
    return cleanup(userId, 1);
  }
  console.log(`✅ organization created: name="${org.name}", slug="${org.slug}", plan=${org.plan}`);

  // Check membership
  const { data: member, error: mErr } = await admin
    .from("organization_members")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", org.id)
    .single();
  if (mErr || !member) {
    console.error("❌ membership NOT created:", mErr?.message);
    return cleanup(userId, 1);
  }
  console.log(`✅ membership created: role=${member.role}`);

  console.log("\n🎉 Signup trigger works end-to-end.\n");
  await cleanup(userId, 0);
}

async function cleanup(userId: string, exitCode: number) {
  console.log(`\nCleaning up test user ${userId}...`);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn(`⚠️  Cleanup warning: ${error.message}`);
  else console.log("✅ Test user deleted (cascade removes profile/org/membership).");
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
