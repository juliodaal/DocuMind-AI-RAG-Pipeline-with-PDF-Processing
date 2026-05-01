import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./StatusBadge";
import type { DocumentStatus } from "@/lib/db/types";

const meta = {
  title: "Documents/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["uploading", "queued", "processing", "ready", "failed"] satisfies DocumentStatus[],
    },
  },
  args: { status: "ready" satisfies DocumentStatus },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { status: "ready" } };
export const Processing: Story = { args: { status: "processing" } };
export const Queued: Story = { args: { status: "queued" } };
export const Uploading: Story = { args: { status: "uploading" } };
export const Failed: Story = { args: { status: "failed" } };

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge status="uploading" />
      <StatusBadge status="queued" />
      <StatusBadge status="processing" />
      <StatusBadge status="ready" />
      <StatusBadge status="failed" />
    </div>
  ),
};
