"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SourceCitation } from "./types";

type Props = {
  citation: SourceCitation;
};

/**
 * Inline [N] citation chip. Hover or click opens a popover anchored to the
 * chip with the chunk excerpt + filename + page.
 */
export function CitationBadge({ citation }: Props) {
  const pageLabel = citation.pageNumber != null ? ` · p. ${citation.pageNumber}` : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md border px-1 align-baseline text-[11px] leading-none font-semibold",
            "border-primary/30 bg-primary/10 text-primary",
            "hover:bg-primary/20 hover:border-primary/50 transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          )}
          aria-label={`Source ${citation.number}: ${citation.documentFilename}${pageLabel}`}
        >
          {citation.number}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={6} className="w-[min(420px,90vw)] p-0">
        <div className="border-border border-b px-4 py-3">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Source {citation.number}
          </div>
          <div className="mt-0.5 truncate text-sm font-medium" title={citation.documentFilename}>
            {citation.documentFilename}
          </div>
          {citation.pageNumber != null && (
            <div className="text-muted-foreground text-xs">Page {citation.pageNumber}</div>
          )}
        </div>
        <ScrollArea className="bg-muted/30 max-h-64 px-4 py-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{citation.preview}</p>
          {citation.preview.length >= 240 && (
            <p className="text-muted-foreground mt-2 text-xs italic">…</p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
