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
          <div className="from-primary/30 to-primary/5 ring-primary/10 mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ring-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary size-6"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Ask anything about your docs</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
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
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
    <div className="text-muted-foreground/80 mt-6 flex flex-wrap justify-center gap-1.5 text-xs">
      {examples.map((e) => (
        <span key={e} className="border-border bg-card rounded-full border px-3 py-1">
          {e}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <AssistantAvatar />}
      <div
        className={cn(
          "max-w-[85%] min-w-0 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm"
            : "text-foreground",
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

function AssistantAvatar() {
  return (
    <div className="from-primary to-primary/70 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-sm">
      AI
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
