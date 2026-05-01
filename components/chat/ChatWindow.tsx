"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { MessageList, type DisplayMessage } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { ChatMessageMetadata } from "@/app/api/chat/route";

type Props = {
  workspaceId: string;
  conversationId?: string;
  conversationTitle?: string;
  initialMessages?: DisplayMessage[];
};

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export function ChatWindow({
  workspaceId,
  conversationId,
  conversationTitle,
  initialMessages = [],
}: Props) {
  const [input, setInput] = useState("");

  const [activeConvId] = useState(() => conversationId ?? crypto.randomUUID());
  const isNewChat = !conversationId;
  const [hasNavigated, setHasNavigated] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { workspaceId, conversationId: activeConvId, messages },
        }),
      }),
    [workspaceId, activeConvId],
  );

  const initialUiMessages: ChatUIMessage[] = useMemo(
    () =>
      initialMessages.map((m) => ({
        id: m.id,
        role: m.role as ChatUIMessage["role"],
        parts: [{ type: "text", text: m.content }],
        metadata:
          m.role === "assistant" && m.citations
            ? ({ conversationId: activeConvId, sources: m.citations } as ChatMessageMetadata)
            : undefined,
      })),
    [initialMessages, activeConvId],
  );

  const { messages, sendMessage, status, error } = useChat<ChatUIMessage>({
    transport,
    messages: initialUiMessages,
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  useEffect(() => {
    if (hasNavigated || !isNewChat) return;
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (hasAssistant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasNavigated(true);
      window.history.replaceState(null, "", `/w/${workspaceId}/chat/${activeConvId}`);
    }
  }, [messages, hasNavigated, isNewChat, workspaceId, activeConvId]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendMessage({ text });
  }, [input, sendMessage]);

  const display: DisplayMessage[] = useMemo(() => {
    const lastAssistantIdx = findLastAssistantIndex(messages);
    return messages.map((m, i) => {
      const meta = (m.metadata as ChatMessageMetadata | undefined) ?? undefined;
      const citations = m.role === "assistant" ? (meta?.sources ?? []) : undefined;
      return {
        id: m.id,
        role: m.role as DisplayMessage["role"],
        content: extractText(m as UIMessage),
        citations,
        pending: status === "streaming" && i === lastAssistantIdx,
      };
    });
  }, [messages, status]);

  const isWorking = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      {(conversationTitle || display.length > 0) && (
        <div className="border-border bg-background/85 flex h-11 items-center border-b px-5 backdrop-blur-md">
          <span className="ds-eyebrow">conversation</span>
          {conversationTitle && (
            <span className="ml-3 truncate text-[13px] font-medium">{conversationTitle}</span>
          )}
        </div>
      )}
      <MessageList messages={display} />
      {error && (
        <div className="text-destructive mx-auto max-w-3xl px-4 py-2 font-mono text-[11px]">
          {error.message}
        </div>
      )}
      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isWorking}
      />
    </div>
  );
}

function findLastAssistantIndex(messages: { role: string }[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return i;
  }
  return -1;
}

function extractText(msg: UIMessage): string {
  const m = msg as unknown as {
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  };
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("");
  }
  return "";
}
