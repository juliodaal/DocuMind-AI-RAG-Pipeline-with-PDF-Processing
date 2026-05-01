import { requireOrg } from "@/lib/auth/require-org";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const metadata = {
  title: "Chat",
};

export default async function NewChatPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireOrg(workspaceId);

  return <ChatWindow workspaceId={workspaceId} />;
}
