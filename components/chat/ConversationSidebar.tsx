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
      <aside className="border-sidebar-border bg-sidebar hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 flex-col border-r md:flex">
        <SidebarBody {...props} />
      </aside>
      <MobileSidebar {...props} />
    </>
  );
}

function MobileSidebar(props: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
      <div className="border-sidebar-border border-b px-3 py-3">
        <Button asChild className="w-full justify-start gap-2 font-mono text-[12px]" size="sm">
          <Link href={`/w/${workspaceId}/chat`}>
            <PlusIcon className="size-3.5" />
            New chat
          </Link>
        </Button>
      </div>
      <div className="px-4 pt-4 pb-2">
        <span className="ds-label">Recent</span>
      </div>
      <ScrollArea className="flex-1">
        {list.length === 0 ? (
          <p className="text-muted-foreground px-4 py-2 font-mono text-[11px]">
            no conversations yet
          </p>
        ) : (
          <ul className="px-1.5">
            {list.map((c) => {
              const active = params.convId === c.id;
              return (
                <li key={c.id} className="group relative">
                  <Link
                    href={`/w/${workspaceId}/chat/${c.id}`}
                    className={cn(
                      "block truncate border-l-2 py-1.5 pr-8 pl-3 font-mono text-[12px] transition-colors",
                      active
                        ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:text-foreground border-transparent hover:bg-white/[0.025]",
                    )}
                    title={c.title ?? "Untitled chat"}
                  >
                    {c.title ?? "Untitled chat"}
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={() => handleDelete(c.id)}
                    className="text-muted-foreground hover:text-destructive absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
