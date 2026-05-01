import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  const orphans = data.users.filter(
    (u) => u.email?.includes("trigger-check-") || u.email?.includes("@example.test"),
  );
  console.log(`Found ${orphans.length} orphan test user(s)`);
  for (const u of orphans) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.warn(`⚠️  ${u.email}: ${error.message}`);
    else console.log(`✅ deleted ${u.email}`);
  }
}

main().catch(console.error);
