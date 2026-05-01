import { createClient as createSupabaseServer } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/auth/admin";
import type { Citation } from "@/lib/rag/citations";

export type ConversationRow = {
  id: string;
  org_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  org_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  tokens_in: number;
  tokens_out: number;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
};

/**
 * Create a new conversation for the current user. Use the admin client because
 * we want the row to exist even if the user navigates away mid-request.
 */
export async function createConversation(args: {
  orgId: string;
  userId: string;
  title?: string | null;
}): Promise<ConversationRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("conversations")
    .insert({
      org_id: args.orgId,
      user_id: args.userId,
      title: args.title ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createConversation: ${error?.message}`);
  return data as ConversationRow;
}

/**
 * Get a conversation by id, or create it with the given id if it doesn't
 * exist. Used for the chat flow where the client generates the conversation
 * id upfront so the URL is stable from the very first message.
 *
 * Returns `{ row, created }` so callers can trigger side effects (like
 * auto-title generation) only on first creation.
 */
export async function getOrCreateConversation(args: {
  id: string;
  orgId: string;
  userId: string;
}): Promise<{ row: ConversationRow; created: boolean }> {
  const admin = createAdminClient();

  const existing = await admin.from("conversations").select("*").eq("id", args.id).maybeSingle();

  if (existing.data) {
    const row = existing.data as ConversationRow;
    if (row.org_id !== args.orgId || row.user_id !== args.userId) {
      throw new Error("Conversation belongs to a different user/org");
    }
    return { row, created: false };
  }

  const { data, error } = await admin
    .from("conversations")
    .insert({ id: args.id, org_id: args.orgId, user_id: args.userId, title: null })
    .select()
    .single();
  if (error || !data) throw new Error(`getOrCreateConversation: ${error?.message}`);
  return { row: data as ConversationRow, created: true };
}

export async function listConversationsForUser(
  orgId: string,
  userId: string,
  limit = 50,
): Promise<ConversationRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ConversationRow[];
}

export async function getConversation(
  orgId: string,
  userId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ConversationRow | null;
}

export async function listMessages(conversationId: string, orgId: string): Promise<MessageRow[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

export type SaveMessageArgs = {
  conversationId: string;
  orgId: string;
  role: MessageRow["role"];
  content: string;
  citations?: Citation[];
  tokensIn?: number;
  tokensOut?: number;
  model?: string | null;
  latencyMs?: number | null;
};

export async function saveMessage(args: SaveMessageArgs): Promise<MessageRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .insert({
      conversation_id: args.conversationId,
      org_id: args.orgId,
      role: args.role,
      content: args.content,
      citations: args.citations ?? [],
      tokens_in: args.tokensIn ?? 0,
      tokens_out: args.tokensOut ?? 0,
      model: args.model ?? null,
      latency_ms: args.latencyMs ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`saveMessage: ${error?.message}`);
  return data as MessageRow;
}

export async function setConversationTitle(conversationId: string, title: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("conversations").update({ title }).eq("id", conversationId);
  if (error) throw new Error(`setConversationTitle: ${error.message}`);
}

export async function deleteConversation(
  orgId: string,
  userId: string,
  conversationId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) throw new Error(`deleteConversation: ${error.message}`);
}
