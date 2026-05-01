"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { MessageContent } from "./MessageContent";
import type { SourceCitation } from "./types";

export type DisplayMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: SourceCitation[];
  pending?: boolean;
};

type Props = {
  messages: DisplayMessage[];
};

export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <span className="ds-eyebrow">conversation · new</span>
          <h2 className="mt-2 text-[28px] font-black tracking-tight">
            Ask anything about your docs
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            DocuMind searches your library, picks the most relevant excerpts, and answers with
            inline citations you can click to verify.
          </p>
          <ExampleQueries />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function ExampleQueries() {
  const examples = [
    "Summarize the key points",
    "What does the document say about X?",
    "Compare two sections",
  ];
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-1.5">
      {examples.map((e) => (
        <span key={e} className="ds-tag">
          {e}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex gap-2.5",
        isUser ? "flex-row-reverse" : "flex-row",
        "[animation:ds-slide-up_var(--dur-3)_var(--ease-out)]",
      )}
    >
      <Avatar isUser={isUser} />
      <div
        className={cn(
          "max-w-[85%] min-w-0 text-[13px] leading-relaxed",
          isUser
            ? "bg-primary/10 border-primary/18 text-foreground rounded-[10px_3px_10px_10px] border px-3.5 py-2.5"
            : "bg-card/60 border-border text-foreground/90 rounded-[3px_10px_10px_10px] border px-3.5 py-2.5",
        )}
      >
        {isUser ? (
          <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <MessageContent content={message.content} citations={message.citations} />
        ) : (
          <ThinkingDots />
        )}
      </div>
    </div>
  );
}

function Avatar({ isUser }: { isUser: boolean }) {
  if (isUser) {
    return (
      <div className="bg-foreground/[0.06] text-foreground/60 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold">
        ME
      </div>
    );
  }
  return (
    <div className="bg-primary/10 text-primary border-primary/25 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] font-semibold">
      AI
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      <span className="bg-muted-foreground/40 h-1.5 w-1.5 [animation:ds-typing-dot_1.2s_ease-in-out_infinite] rounded-full" />
      <span className="bg-muted-foreground/40 h-1.5 w-1.5 [animation:ds-typing-dot_1.2s_ease-in-out_0.15s_infinite] rounded-full" />
      <span className="bg-muted-foreground/40 h-1.5 w-1.5 [animation:ds-typing-dot_1.2s_ease-in-out_0.3s_infinite] rounded-full" />
    </span>
  );
}
