"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SourceCitation } from "./types";

type Props = {
  citation: SourceCitation;
};

/**
 * Renders an inline [N] citation badge that:
 * - Shows a tooltip with filename + page on hover
 * - Opens a dialog with the full chunk preview on click
 */
export function CitationBadge({ citation }: Props) {
  const [open, setOpen] = useState(false);
  const pageLabel = citation.pageNumber != null ? `, p. ${citation.pageNumber}` : "";

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-primary hover:bg-primary/10 mx-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-current/30 bg-current/5 px-1 align-baseline text-[11px] leading-none font-semibold transition-colors"
              aria-label={`View source ${citation.number}: ${citation.documentFilename}${pageLabel}`}
            >
              {citation.number}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            <div className="font-medium">{citation.documentFilename}</div>
            {citation.pageNumber != null && (
              <div className="text-muted-foreground">Page {citation.pageNumber}</div>
            )}
            <div className="text-muted-foreground mt-1 italic">Click to view excerpt</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Source {citation.number} · {citation.documentFilename}
              {pageLabel}
            </DialogTitle>
            <DialogDescription>Excerpt used to ground the answer above.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="bg-muted/40 max-h-80 rounded-md border p-4">
            <p className="text-sm whitespace-pre-wrap">{citation.preview}</p>
            {citation.preview.length >= 240 && (
              <p className="text-muted-foreground mt-2 text-xs">…</p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
