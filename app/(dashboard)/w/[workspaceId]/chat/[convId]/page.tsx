import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/auth/require-org";
import { getConversation, listMessages } from "@/lib/db/queries/conversations";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { DisplayMessage } from "@/components/chat/MessageList";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; convId: string }>;
}) {
  const { workspaceId, convId } = await params;
  const { user, org } = await requireOrg(workspaceId);
  const conv = await getConversation(org.id, user.id, convId);
  return { title: conv?.title ?? "Chat" };
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ workspaceId: string; convId: string }>;
}) {
  const { workspaceId, convId } = await params;
  const { user, org } = await requireOrg(workspaceId);

  const conv = await getConversation(org.id, user.id, convId);
  if (!conv) notFound();

  const rows = await listMessages(convId, org.id);

  const initialMessages: DisplayMessage[] = rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: (m.citations as unknown as DisplayMessage["citations"]) ?? [],
  }));

  return (
    <ChatWindow
      workspaceId={workspaceId}
      conversationId={convId}
      initialMessages={initialMessages}
    />
  );
}
