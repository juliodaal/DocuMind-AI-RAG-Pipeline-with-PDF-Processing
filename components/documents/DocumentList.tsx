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

  const docs = useMemo(() => {
    const seen = new Set<string>();
    const result: Document[] = [];
    for (const d of initialDocuments) {
      const o = overrides.get(d.id);
      if (o === "deleted") continue;
      result.push(o ?? d);
      seen.add(d.id);
    }
    for (const [id, o] of overrides.entries()) {
      if (o !== "deleted" && !seen.has(id)) result.unshift(o);
    }
    return result;
  }, [initialDocuments, overrides]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
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
      <div className="ds-empty">
        <FileIcon className="text-muted-foreground size-6" />
        <div className="text-[13px] font-medium">No documents yet</div>
        <p className="ds-mono">upload a pdf above to get started</p>
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
      toast.success(`Re-processing ${filename}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-process failed");
    }
  }

  return (
    <div className="border-border overflow-hidden rounded-[10px] border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-border border-b">
            <th className="ds-label py-2.5 pr-3 pl-4 text-left">file</th>
            <th className="ds-label hidden py-2.5 pr-3 text-left sm:table-cell">size</th>
            <th className="ds-label hidden py-2.5 pr-3 text-left md:table-cell">pages</th>
            <th className="ds-label hidden py-2.5 pr-3 text-left lg:table-cell">added</th>
            <th className="ds-label py-2.5 pr-3 text-left">status</th>
            <th className="py-2.5 pr-3" />
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr
              key={d.id}
              className="group border-border/60 border-b transition-colors last:border-0 hover:bg-white/[0.02]"
            >
              <td className="py-3 pr-3 pl-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileIcon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium" title={d.filename}>
                      {d.filename}
                    </div>
                    {d.error && (
                      <div className="text-destructive mt-0.5 truncate font-mono text-[10px]">
                        {d.error}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-foreground/60 hidden py-3 pr-3 font-mono text-[11px] sm:table-cell">
                {formatBytes(d.size_bytes)}
              </td>
              <td className="text-foreground/60 hidden py-3 pr-3 font-mono text-[11px] md:table-cell">
                {d.page_count ?? "—"}
              </td>
              <td className="text-foreground/50 hidden py-3 pr-3 font-mono text-[11px] lg:table-cell">
                {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
              </td>
              <td className="py-3 pr-3">
                <StatusBadge status={d.status} />
              </td>
              <td className="py-3 pr-3">
                <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {d.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-mono text-[11px]"
                      onClick={() => handleReprocess(d.id, d.filename)}
                    >
                      retry
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pendingDeletes.has(d.id) || d.status === "processing"}
                    onClick={() => handleDelete(d.id, d.filename)}
                    aria-label={`Delete ${d.filename}`}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
