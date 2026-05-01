import type { ReactNode } from "react";
import { requireOrg } from "@/lib/auth/require-org";
import { listConversationsForUser } from "@/lib/db/queries/conversations";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { deleteConversationAction } from "./actions";

export default async function ChatLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { user, org } = await requireOrg(workspaceId);
  const conversations = await listConversationsForUser(org.id, user.id);

  const onDelete = deleteConversationAction.bind(null, workspaceId);

  return (
    <div className="flex">
      <ConversationSidebar
        workspaceId={workspaceId}
        conversations={conversations}
        onDeleteConversation={onDelete}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
