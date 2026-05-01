import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const mask = (s: string) => (s.length <= 8 ? "***" : `${s.slice(0, 4)}...${s.slice(-4)}`);

import("../lib/env")
  .then(({ env }) => {
    console.log("✅ Environment validation passed\n");
    console.log("Supabase:");
    console.log(`  URL:           ${env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`  Anon key:      ${mask(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}`);
    console.log(`  Service role:  ${mask(env.SUPABASE_SERVICE_ROLE_KEY)}`);
    console.log(`  Storage bucket: ${env.SUPABASE_STORAGE_BUCKET}`);
    console.log("\nOpenAI:");
    console.log(`  API key:       ${mask(env.OPENAI_API_KEY)}`);
    console.log(`  Chat model:    ${env.OPENAI_CHAT_MODEL}`);
    console.log(`  Embed model:   ${env.OPENAI_EMBEDDING_MODEL}`);
    console.log("\nInngest:");
    console.log(
      `  Event key:     ${env.INNGEST_EVENT_KEY ? mask(env.INNGEST_EVENT_KEY) : "(not set)"}`,
    );
    console.log(
      `  Signing key:   ${env.INNGEST_SIGNING_KEY ? mask(env.INNGEST_SIGNING_KEY) : "(not set)"}`,
    );
    console.log("\nUpstash Redis:");
    console.log(`  URL:           ${env.UPSTASH_REDIS_REST_URL ?? "(not set)"}`);
    console.log(
      `  Token:         ${env.UPSTASH_REDIS_REST_TOKEN ? mask(env.UPSTASH_REDIS_REST_TOKEN) : "(not set)"}`,
    );
  })
  .catch((err: Error) => {
    console.error("❌ Environment validation failed:");
    console.error(err.message);
    process.exit(1);
  });
