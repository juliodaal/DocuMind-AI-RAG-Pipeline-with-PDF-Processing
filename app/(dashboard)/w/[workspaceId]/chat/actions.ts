"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/auth/require-org";
import { deleteConversation } from "@/lib/db/queries/conversations";

export async function deleteConversationAction(workspaceId: string, conversationId: string) {
  const { user, org } = await requireOrg(workspaceId);
  await deleteConversation(org.id, user.id, conversationId);
  revalidatePath(`/w/${workspaceId}/chat`);
  revalidatePath(`/w/${workspaceId}/chat/${conversationId}`);
}
