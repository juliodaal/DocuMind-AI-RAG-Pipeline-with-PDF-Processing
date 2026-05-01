import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MessageList } from "./MessageList";

const meta = {
  title: "Chat/MessageList",
  component: MessageList,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="bg-background text-foreground flex h-svh">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MessageList>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseCitation = {
  chunkId: "c1",
  documentId: "d1",
  documentFilename: "rag-architecture.pdf",
  pageNumber: 7,
  preview:
    "Hybrid search combines pgvector cosine similarity with BM25-style full-text ranking, " +
    "fused via Reciprocal Rank Fusion (k=60).",
};

export const Empty: Story = { args: { messages: [] } };

export const Conversation: Story = {
  args: {
    messages: [
      { id: "m1", role: "user", content: "What embedding model do you use and why?" },
      {
        id: "m2",
        role: "assistant",
        content:
          "DocuMind uses OpenAI **text-embedding-3-small** [1] — it's the cheapest competent model in the lineup at $0.02 per million tokens, and produces 1536-dimensional vectors that index well in pgvector with HNSW [2].",
        citations: [
          { ...baseCitation, number: 1, pageNumber: 1 },
          { ...baseCitation, number: 2, pageNumber: 3 },
        ],
      },
    ],
  },
};

export const Streaming: Story = {
  args: {
    messages: [
      { id: "m1", role: "user", content: "Summarize the chunking strategy." },
      { id: "m2", role: "assistant", content: "", pending: true },
    ],
  },
};
