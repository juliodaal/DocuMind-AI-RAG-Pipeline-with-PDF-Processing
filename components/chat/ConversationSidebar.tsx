"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ConversationRow } from "@/lib/db/queries/conversations";

type Props = {
  workspaceId: string;
  conversations: ConversationRow[];
  onDeleteConversation: (conversationId: string) => Promise<void>;
};

export function ConversationSidebar({ workspaceId, conversations, onDeleteConversation }: Props) {
  const params = useParams<{ convId?: string }>();
  const router = useRouter();
  const [list, setList] = useState(conversations);
  const [, startTransition] = useTransition();

  async function handleDelete(id: string) {
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    try {
      await onDeleteConversation(id);
      setList((prev) => prev.filter((c) => c.id !== id));
      if (params.convId === id) {
        startTransition(() => router.push(`/w/${workspaceId}/chat`));
      }
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <aside className="border-border bg-card flex h-[calc(100svh-3.5rem)] w-64 flex-col border-r">
      <div className="border-border border-b p-3">
        <Button asChild className="w-full" size="sm">
          <Link href={`/w/${workspaceId}/chat`}>+ New chat</Link>
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {list.length === 0 ? (
          <p className="text-muted-foreground p-4 text-xs">No conversations yet.</p>
        ) : (
          <ul className="space-y-0.5 p-2">
            {list.map((c) => {
              const active = params.convId === c.id;
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={`/w/${workspaceId}/chat/${c.id}`}
                    className={cn(
                      "block truncate rounded-md px-3 py-2 pr-8 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60 hover:text-accent-foreground",
                    )}
                  >
                    {c.title ?? "Untitled chat"}
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={() => handleDelete(c.id)}
                    className="text-muted-foreground hover:text-destructive absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
