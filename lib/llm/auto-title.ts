import { getOpenAI } from "@/lib/llm/openai";
import { recordUsage } from "@/lib/llm/usage";
import { env } from "@/lib/env";

/**
 * Generate a 3-6 word title from the user's first message. Cheap call
 * (gpt-4o-mini, max_tokens=20) — costs fractions of a cent per conversation.
 */
export async function generateConversationTitle(
  question: string,
  args: { orgId: string; userId: string | null },
): Promise<string> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    max_tokens: 20,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Generate a 3-6 word title (Title Case, no quotes, no trailing punctuation) summarizing this user question. Match the question's language.",
      },
      { role: "user", content: question.slice(0, 500) },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim() ?? "New chat";
  const cleaned = raw
    .replace(/^["']|["']$/g, "")
    .replace(/[.!?]+$/, "")
    .slice(0, 80);

  void recordUsage({
    orgId: args.orgId,
    userId: args.userId,
    kind: "auto_title",
    model: env.OPENAI_CHAT_MODEL,
    tokensIn: res.usage?.prompt_tokens ?? 0,
    tokensOut: res.usage?.completion_tokens ?? 0,
    cachedTokensIn: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  });

  return cleaned || "New chat";
}
