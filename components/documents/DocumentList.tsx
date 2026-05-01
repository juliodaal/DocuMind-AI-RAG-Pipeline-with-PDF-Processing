"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import type { Document } from "@/lib/db/types";

type Props = {
  workspaceId: string;
  initialDocuments: Document[];
  onDeleteDocument: (documentId: string) => Promise<void>;
  onReprocessDocument: (documentId: string) => Promise<void>;
};

type Override = Document | "deleted";

export function DocumentList({
  workspaceId,
  initialDocuments,
  onDeleteDocument,
  onReprocessDocument,
}: Props) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Map<string, Override>>(new Map());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Derive the rendered list from props + realtime overrides.
  // Avoids the setState-in-effect anti-pattern.
  const docs = useMemo(() => {
    const seen = new Set<string>();
    const result: Document[] = [];
    for (const d of initialDocuments) {
      const o = overrides.get(d.id);
      if (o === "deleted") continue;
      result.push(o ?? d);
      seen.add(d.id);
    }
    // Newly inserted docs from realtime that aren't in the prop yet
    for (const [id, o] of overrides.entries()) {
      if (o !== "deleted" && !seen.has(id)) result.unshift(o);
    }
    return result;
  }, [initialDocuments, overrides]);

  // Realtime subscription for status updates within this workspace.
  // Postgres Changes channels honor RLS — the JWT must be set on Realtime
  // before subscribing or the broadcast filters out everything (silent miss).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;

      // Force Realtime to use the current access token for RLS-aware channels.
      supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`documents:${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "documents",
            filter: `org_id=eq.${workspaceId}`,
          },
          (payload) => {
            if (payload.eventType === "UPDATE") {
              const next = payload.new as Document;
              setOverrides((m) => new Map(m).set(next.id, next));
            } else if (payload.eventType === "INSERT") {
              const next = payload.new as Document;
              setOverrides((m) => new Map(m).set(next.id, next));
              startTransition(() => router.refresh());
            } else if (payload.eventType === "DELETE") {
              const id = (payload.old as { id: string }).id;
              setOverrides((m) => new Map(m).set(id, "deleted"));
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [workspaceId, router]);

  if (docs.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground text-sm">No documents yet. Upload a PDF above.</p>
      </div>
    );
  }

  async function handleDelete(id: string, filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setPendingDeletes((s) => new Set(s).add(id));
    try {
      await onDeleteDocument(id);
      setOverrides((m) => new Map(m).set(id, "deleted"));
      toast.success(`Deleted ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPendingDeletes((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleReprocess(id: string, filename: string) {
    try {
      await onReprocessDocument(id);
      toast.success(`Re-processing ${filename}...`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-process failed");
    }
  }

  return (
    <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-lg border">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center gap-3 p-3 text-sm">
          <FileIcon className="text-muted-foreground h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{d.filename}</div>
            <div className="text-muted-foreground flex gap-2 text-xs">
              <span>{formatBytes(d.size_bytes)}</span>
              {d.page_count != null ? <span>· {d.page_count} pages</span> : null}
              <span>· {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
              {d.error ? <span className="text-destructive">· {d.error}</span> : null}
            </div>
          </div>
          <StatusBadge status={d.status} />
          {d.status === "failed" && (
            <Button size="sm" variant="outline" onClick={() => handleReprocess(d.id, d.filename)}>
              Retry
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pendingDeletes.has(d.id) || d.status === "processing"}
            onClick={() => handleDelete(d.id, d.filename)}
            aria-label={`Delete ${d.filename}`}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
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
