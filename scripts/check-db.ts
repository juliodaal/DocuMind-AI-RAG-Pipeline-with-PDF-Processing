import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const tables = ["profiles", "organizations", "organization_members"] as const;

  console.log("Checking schema...\n");
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`❌ ${t}: ${error.message}`);
    } else {
      console.log(`✅ ${t}: exists (count=${count})`);
    }
  }

  console.log("\nChecking RLS helpers...");
  const { data, error } = await supabase.rpc("is_org_member", {
    target_org: "00000000-0000-0000-0000-000000000000",
  });
  if (error && error.code === "PGRST202") {
    console.log("❌ is_org_member function not exposed via PostgREST (might be ok if internal)");
  } else if (error) {
    console.log(`⚠️  is_org_member returned error: ${error.message}`);
  } else {
    console.log(`✅ is_org_member callable, returned: ${data}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
