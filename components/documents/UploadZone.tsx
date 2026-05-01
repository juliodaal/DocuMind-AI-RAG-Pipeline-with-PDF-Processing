"use client";

import { useCallback, useState, useTransition } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, validateUpload } from "@/lib/storage/keys";

type Props = {
  workspaceId: string;
  onCreateUploadSession: (input: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }) => Promise<{ documentId: string; uploadUrl: string; token: string; path: string }>;
  onConfirmUpload: (documentId: string) => Promise<void>;
};

type UploadingItem = {
  id: string; // local id (filename + size)
  filename: string;
  progress: number;
  error?: string;
};

export function UploadZone({ workspaceId, onCreateUploadSession, onConfirmUpload }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<UploadingItem[]>([]);
  const [isPending, startTransition] = useTransition();
  void workspaceId; // workspace context comes from server actions

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      for (const r of rejections) {
        toast.error(`Rejected ${r.file.name}: ${r.errors[0]?.message ?? "invalid"}`);
      }

      for (const file of acceptedFiles) {
        const v = validateUpload(file.name, file.type, file.size);
        if (!v.ok) {
          toast.error(`${file.name}: ${v.reason}`);
          continue;
        }

        const localId = `${file.name}-${file.size}-${Date.now()}`;
        setItems((s) => [...s, { id: localId, filename: file.name, progress: 0 }]);

        try {
          const session = await onCreateUploadSession({
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          });

          await uploadWithProgress(session.uploadUrl, file, (pct) =>
            setItems((s) => s.map((it) => (it.id === localId ? { ...it, progress: pct } : it))),
          );

          await onConfirmUpload(session.documentId);
          setItems((s) => s.filter((it) => it.id !== localId));
          toast.success(`${file.name} uploaded — processing...`);
          startTransition(() => router.refresh());
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setItems((s) =>
            s.map((it) => (it.id === localId ? { ...it, error: msg, progress: 0 } : it)),
          );
          toast.error(`${file.name}: ${msg}`);
        }
      }
    },
    [onCreateUploadSession, onConfirmUpload, router],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_FILE_BYTES,
    multiple: true,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-border bg-card hover:bg-accent/30 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragActive && "border-primary bg-accent/50",
          isPending && "opacity-60",
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop PDFs here" : "Drag PDFs here, or click to browse"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Up to {Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB ·{" "}
          {ALLOWED_MIME_TYPES.map((m) => m.split("/")[1]).join(", ")}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="border-border bg-card flex items-center gap-3 rounded-md border p-3 text-sm"
            >
              <div className="flex-1 truncate">{it.filename}</div>
              {it.error ? (
                <span className="text-destructive text-xs">{it.error}</span>
              ) : (
                <div className="flex w-32 items-center gap-2">
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 text-right text-xs">
                    {Math.round(it.progress)}%
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) onProgress((evt.loaded / evt.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

function UploadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
