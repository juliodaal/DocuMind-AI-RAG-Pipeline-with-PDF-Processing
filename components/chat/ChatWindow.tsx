"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageList, type DisplayMessage } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { SourceCitation } from "./types";
import type { ChatMessageMetadata } from "@/app/api/chat/route";

type Props = {
  workspaceId: string;
  conversationId?: string;
  initialMessages?: DisplayMessage[];
};

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

export function ChatWindow({ workspaceId, conversationId, initialMessages = [] }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");

  // For new chats, generate the conversation UUID upfront so the URL becomes
  // stable as soon as the first response starts streaming. useState with a
  // lazy initializer keeps the value stable across renders without using a ref.
  const [activeConvId] = useState(() => conversationId ?? crypto.randomUUID());
  const isNewChat = !conversationId;
  const [hasNavigated, setHasNavigated] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            workspaceId,
            conversationId: activeConvId,
            messages,
          },
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

  // For brand-new chats, navigate to the permalink as soon as we have an
  // assistant message in the messages array (which means the stream started).
  // The setHasNavigated call is a one-shot guard so we don't re-navigate on
  // every streaming token — the eslint rule against setState-in-effect doesn't
  // distinguish this case from infinite loops.
  useEffect(() => {
    if (hasNavigated || !isNewChat) return;
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (hasAssistant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasNavigated(true);
      router.replace(`/w/${workspaceId}/chat/${activeConvId}`);
    }
  }, [messages, hasNavigated, isNewChat, router, workspaceId, activeConvId]);

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
      let citations: SourceCitation[] | undefined;
      if (m.role === "assistant") {
        // While streaming, server attaches sources via messageMetadata 'start'.
        // After finish, our DB-stored citations override (only [n] actually used).
        citations = meta?.sources ?? [];
      }
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
      <MessageList messages={display} />
      {error && (
        <div className="text-destructive mx-auto max-w-3xl px-4 py-2 text-sm">{error.message}</div>
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
