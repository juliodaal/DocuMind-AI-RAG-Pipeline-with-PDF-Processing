import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/db/types";

const variants: Record<DocumentStatus, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "bg-blue-50 text-blue-700 border-blue-200" },
  queued: { label: "Queued", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  processing: {
    label: "Processing",
    className: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
  },
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}
