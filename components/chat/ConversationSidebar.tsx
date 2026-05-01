"use client";

import Link from "next/link";
import { usePathname, useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ConversationRow } from "@/lib/db/queries/conversations";

type Props = {
  workspaceId: string;
  conversations: ConversationRow[];
  onDeleteConversation: (conversationId: string) => Promise<void>;
};

export function ConversationSidebar(props: Props) {
  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="border-border bg-card hidden h-[calc(100svh-3.5rem)] w-64 shrink-0 flex-col border-r md:flex">
        <SidebarBody {...props} />
      </aside>

      {/* Mobile: hamburger + Sheet */}
      <MobileSidebar {...props} />
    </>
  );
}

function MobileSidebar(props: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Auto-close drawer on route change. Intentional sync — eslint flags any
  // setState-in-effect, but this is the canonical pattern for closing a
  // dialog when its triggering navigation completes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open conversations"
          className="absolute top-2 left-2 z-20 md:hidden"
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Conversations</SheetTitle>
        <SidebarBody {...props} />
      </SheetContent>
    </Sheet>
  );
}

function SidebarBody({ workspaceId, conversations, onDeleteConversation }: Props) {
  const params = useParams<{ convId?: string }>();
  const router = useRouter();
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Derived list — props are the source of truth; deletions are an overlay.
  const list = conversations.filter((c) => !deleted.has(c.id));

  async function handleDelete(id: string) {
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    try {
      await onDeleteConversation(id);
      setDeleted((prev) => new Set(prev).add(id));
      if (params.convId === id) {
        startTransition(() => router.push(`/w/${workspaceId}/chat`));
      }
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b p-3">
        <Button asChild className="w-full justify-start gap-2" size="sm">
          <Link href={`/w/${workspaceId}/chat`}>
            <PlusIcon className="size-3.5" />
            New chat
          </Link>
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {list.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-xs">
            No conversations yet.
            <br />
            Start one above.
          </p>
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
                        : "text-foreground/80 hover:bg-accent/60 hover:text-accent-foreground",
                    )}
                    title={c.title ?? "Untitled chat"}
                  >
                    {c.title ?? "Untitled chat"}
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={() => handleDelete(c.id)}
                    className="text-muted-foreground hover:text-destructive absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
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
