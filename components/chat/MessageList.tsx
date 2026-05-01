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
          <h2 className="text-2xl font-semibold tracking-tight">Ask anything about your docs</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            DocuMind searches your library, picks the most relevant excerpts, and answers with
            inline citations you can click to verify.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="bg-primary text-primary-foreground mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-card border-border border",
          message.pending && !message.content && "animate-pulse",
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

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-2">
      <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-muted-foreground/40 h-1.5 w-1.5 animate-bounce rounded-full" />
    </span>
  );
}
