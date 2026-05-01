import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta = {
  title: "Primitives/Tag",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Tiny mono uppercase chip used for status indicators, role labels, and metadata. Variants follow the semantic color set.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="ds-tag">default</span>
      <span className="ds-tag ds-tag-accent ds-tag-dot">ready</span>
      <span className="ds-tag ds-tag-warn ds-tag-dot">processing</span>
      <span className="ds-tag ds-tag-error ds-tag-dot">failed</span>
      <span className="ds-tag ds-tag-info">info</span>
    </div>
  ),
};

export const StatusFlow: Story = {
  render: () => (
    <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--text-3)]">
      <span className="ds-tag ds-tag-info ds-tag-dot">uploading</span>
      <span>→</span>
      <span className="ds-tag">queued</span>
      <span>→</span>
      <span className="ds-tag ds-tag-warn ds-tag-dot animate-pulse">processing</span>
      <span>→</span>
      <span className="ds-tag ds-tag-accent ds-tag-dot">ready</span>
    </div>
  ),
};

export const RolesAndMeta: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="ds-tag">owner</span>
      <span className="ds-tag">admin</span>
      <span className="ds-tag">member</span>
      <span className="ds-tag ds-tag-accent">beta</span>
      <span className="ds-tag ds-tag-info">v1.2</span>
    </div>
  ),
};
