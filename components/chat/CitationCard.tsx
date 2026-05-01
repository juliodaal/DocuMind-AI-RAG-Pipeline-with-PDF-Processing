"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SourceCitation } from "./types";

type Props = {
  citation: SourceCitation;
};

export function CitationBadge({ citation }: Props) {
  const pageLabel = citation.pageNumber != null ? ` · p. ${citation.pageNumber}` : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-primary/25 bg-primary/8 text-primary mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border px-1.5 align-baseline font-mono text-[10px] leading-none font-semibold",
            "hover:bg-primary/15 hover:border-primary/40 transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          )}
          aria-label={`Source ${citation.number}: ${citation.documentFilename}${pageLabel}`}
        >
          {citation.number}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-[min(420px,90vw)] overflow-hidden p-0"
      >
        <div className="border-border border-b px-4 py-3">
          <div className="ds-label mb-1.5">Source {citation.number}</div>
          <div className="truncate text-[13px] font-medium" title={citation.documentFilename}>
            {citation.documentFilename}
          </div>
          {citation.pageNumber != null && (
            <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
              page {citation.pageNumber}
            </div>
          )}
        </div>
        <ScrollArea className="bg-muted/40 max-h-64 px-4 py-3">
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{citation.preview}</p>
          {citation.preview.length >= 240 && (
            <p className="text-muted-foreground mt-2 font-mono text-[10px] italic">… truncated</p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
