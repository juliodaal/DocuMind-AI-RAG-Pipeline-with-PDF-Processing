import { createAdminClient } from "@/lib/auth/admin";
import { computeCostCents } from "@/lib/llm/openai";
import type { UsageKind } from "@/lib/db/types";

export type RecordUsageArgs = {
  orgId: string;
  userId?: string | null;
  kind: UsageKind;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  cachedTokensIn?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Record an LLM usage event. Computes cost_cents from model + token counts.
 * Logs and swallows failures — usage tracking should never break the main flow.
 */
export async function recordUsage(args: RecordUsageArgs): Promise<void> {
  const tokensIn = args.tokensIn ?? 0;
  const tokensOut = args.tokensOut ?? 0;
  const costCents = computeCostCents({
    model: args.model,
    tokensIn,
    tokensOut,
    cachedTokensIn: args.cachedTokensIn,
  });

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("usage_events").insert({
      org_id: args.orgId,
      user_id: args.userId ?? null,
      kind: args.kind,
      model: args.model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_cents: costCents,
      metadata: args.metadata ?? {},
    });
    if (error) {
      console.warn(`[usage] insert failed: ${error.message}`);
    }
  } catch (err) {
    console.warn("[usage] unexpected error", err);
  }
}
