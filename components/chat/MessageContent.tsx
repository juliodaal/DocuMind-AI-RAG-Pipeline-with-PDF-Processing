"use client";

import { Fragment, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationBadge } from "./CitationCard";
import type { SourceCitation } from "./types";

type Props = {
  content: string;
  citations?: SourceCitation[];
};

/**
 * Renders an assistant message with markdown + interactive [N] citation badges.
 * Strategy:
 *   1. Run a regex over the raw text and split on [N] markers.
 *   2. Render the surrounding text segments through react-markdown.
 *   3. Render each [N] match as a CitationBadge.
 */
export function MessageContent({ content, citations = [] }: Props) {
  const byNumber = useMemo(() => {
    const map = new Map<number, SourceCitation>();
    for (const c of citations) map.set(c.number, c);
    return map;
  }, [citations]);

  const segments = useMemo(() => splitOnCitations(content), [content]);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return (
            <Fragment key={i}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Strip outer <p> when followed/preceded by a citation so badges flow inline
                  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
                  pre: ({ children }) => (
                    <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => (
                    <code className={className ?? "bg-muted rounded px-1 text-xs"}>{children}</code>
                  ),
                }}
              >
                {seg.text}
              </ReactMarkdown>
            </Fragment>
          );
        }
        const citation = byNumber.get(seg.number);
        if (!citation) {
          // Unmatched [N] — render as plain text so it doesn't disappear
          return <span key={i}>[{seg.number}]</span>;
        }
        return <CitationBadge key={i} citation={citation} />;
      })}
    </div>
  );
}

type Segment = { kind: "text"; text: string } | { kind: "citation"; number: number };

function splitOnCitations(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ kind: "text", text: text.slice(last, match.index) });
    }
    segments.push({ kind: "citation", number: parseInt(match[1]!, 10) });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", text: text.slice(last) });
  }
  return segments;
}
