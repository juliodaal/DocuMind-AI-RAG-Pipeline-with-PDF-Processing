import { NextResponse, type NextRequest } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/auth/server";
import { hybridSearch } from "@/lib/rag/retriever";
import { SYSTEM_PROMPT, buildContext, buildUserMessage } from "@/lib/rag/prompt";
import { extractCitations } from "@/lib/rag/citations";
import {
  getOrCreateConversation,
  saveMessage,
  setConversationTitle,
} from "@/lib/db/queries/conversations";
import { generateConversationTitle } from "@/lib/llm/auto-title";
import { recordUsage } from "@/lib/llm/usage";
import { env } from "@/lib/env";
import type { SourceCitation } from "@/components/chat/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  // Always provided by the client (UUID generated at message time for new chats).
  conversationId: z.string().uuid(),
  messages: z.array(
    z
      .object({
        role: z.enum(["user", "assistant", "system"]),
      })
      .passthrough(),
  ),
});

export type ChatMessageMetadata = {
  conversationId: string;
  sources: SourceCitation[];
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { workspaceId, conversationId, messages } = parsed.data;
  const uiMessages = messages as unknown as UIMessage[];

  // Validate org membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", workspaceId)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Last UI message is the user's question
  const lastUiMessage = uiMessages[uiMessages.length - 1];
  if (!lastUiMessage || lastUiMessage.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }
  const question = extractText(lastUiMessage);
  if (!question.trim()) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  // Resolve or create conversation (idempotent — UUID is client-generated)
  const { created: isNewConversation } = await getOrCreateConversation({
    id: conversationId,
    orgId: workspaceId,
    userId: user.id,
  });

  // Persist the user message (best-effort)
  await saveMessage({
    conversationId,
    orgId: workspaceId,
    role: "user",
    content: question,
  }).catch((err) => console.warn("[chat] saveMessage(user) failed", err));

  // Hybrid retrieval
  const t0 = Date.now();
  const chunks = await hybridSearch(workspaceId, question, { userId: user.id });
  const { context, ordered } = buildContext(chunks);

  const sources: SourceCitation[] = ordered.map((c, i) => ({
    number: i + 1,
    chunkId: c.chunkId,
    documentId: c.documentId,
    documentFilename: c.documentFilename,
    pageNumber: c.pageNumber,
    preview: c.content.slice(0, 240),
  }));

  // Compose model messages
  const historyMessages = uiMessages.slice(0, -1);
  const modelHistory = await convertToModelMessages(historyMessages as UIMessage[]);
  const userWithContext = buildUserMessage(question, context);

  // Auto-title for new conversations (fire-and-forget)
  if (isNewConversation) {
    void generateConversationTitle(question, { orgId: workspaceId, userId: user.id })
      .then((title) => setConversationTitle(conversationId, title))
      .catch((err) => console.warn("[chat] auto-title failed", err));
  }

  const result = streamText({
    model: openai(env.OPENAI_CHAT_MODEL),
    system: SYSTEM_PROMPT,
    messages: [...modelHistory, { role: "user" as const, content: userWithContext }],
    onFinish: async ({ text, usage }) => {
      const latencyMs = Date.now() - t0;
      const citations = extractCitations(text, ordered);

      try {
        await saveMessage({
          conversationId,
          orgId: workspaceId,
          role: "assistant",
          content: text,
          citations,
          tokensIn: usage?.inputTokens ?? 0,
          tokensOut: usage?.outputTokens ?? 0,
          model: env.OPENAI_CHAT_MODEL,
          latencyMs,
        });
      } catch (err) {
        console.warn("[chat] saveMessage(assistant) failed", err);
      }

      void recordUsage({
        orgId: workspaceId,
        userId: user.id,
        kind: "chat",
        model: env.OPENAI_CHAT_MODEL,
        tokensIn: usage?.inputTokens ?? 0,
        tokensOut: usage?.outputTokens ?? 0,
        cachedTokensIn: usage?.cachedInputTokens ?? 0,
        metadata: {
          conversation_id: conversationId,
          retrieved_chunks: ordered.length,
          citation_count: citations.length,
        },
      });
    },
  });

  return result.toUIMessageStreamResponse({
    // Attach the sources (with conversationId) to the assistant message metadata
    // at stream start so the client can render citation badges immediately.
    messageMetadata: ({ part }) => {
      if (part.type === "start") {
        const meta: ChatMessageMetadata = { conversationId, sources };
        return meta;
      }
      return undefined;
    },
  });
}

function extractText(msg: UIMessage): string {
  const m = msg as unknown as {
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  };
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("");
  }
  return "";
}
