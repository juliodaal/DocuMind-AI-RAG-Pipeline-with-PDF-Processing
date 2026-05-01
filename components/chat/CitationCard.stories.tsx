import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CitationBadge } from "./CitationCard";

const meta = {
  title: "Chat/CitationBadge",
  component: CitationBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Inline `[N]` citation chip rendered next to the assistant's claims. Click or hover to reveal the source excerpt in a popover.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CitationBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const sample = {
  number: 1,
  chunkId: "chunk-1",
  documentId: "doc-1",
  documentFilename: "rag-architecture.pdf",
  pageNumber: 7,
  preview:
    "Hybrid search combines pgvector cosine similarity with BM25-style full-text ranking. " +
    "Reciprocal Rank Fusion with k=60 merges both lists into a final top-K ordering that " +
    "consistently beats either retriever in isolation across recall and precision metrics.",
};

export const Default: Story = { args: { citation: sample } };

export const InProse: Story = {
  args: { citation: sample },
  render: () => (
    <p className="max-w-md text-[13px] leading-relaxed">
      The pipeline uses pgvector with HNSW for cosine similarity{" "}
      <CitationBadge citation={{ ...sample, number: 1 }} /> and falls back to BM25 ranking via
      Postgres tsvector <CitationBadge citation={{ ...sample, number: 2, pageNumber: 12 }} />. Both
      lists are fused with RRF <CitationBadge citation={{ ...sample, number: 3, pageNumber: 14 }} />
      .
    </p>
  ),
};

export const NoPage: Story = {
  args: { citation: { ...sample, pageNumber: null } },
};
