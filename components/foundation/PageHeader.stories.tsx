import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta = {
  title: "Foundation/Page header",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The eyebrow + huge bold title + mono sub pattern used to anchor every dashboard page.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <header className="ds-page-header">
      <span className="ds-eyebrow">workspace · owner</span>
      <h1 className="ds-page-title">Julio Daal&apos;s workspace</h1>
      <p className="ds-page-sub">3 documents · 142 chunks indexed</p>
    </header>
  ),
};

export const WithEmptyState: Story = {
  render: () => (
    <div className="space-y-6">
      <header className="ds-page-header">
        <span className="ds-eyebrow">workspace · library</span>
        <h1 className="ds-page-title">Documents</h1>
        <p className="ds-page-sub">0 ready · 0 total · ~0 pages indexed</p>
      </header>
      <div className="ds-empty">
        <FileIcon />
        <div className="text-[13px] font-medium">No documents yet</div>
        <p className="ds-mono">upload a pdf above to get started</p>
      </div>
    </div>
  ),
};

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="text-muted-foreground size-6"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
