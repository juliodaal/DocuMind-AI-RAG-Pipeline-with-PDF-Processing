import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { MessageInput } from "./MessageInput";

const meta = {
  title: "Chat/MessageInput",
  component: MessageInput,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="bg-background flex h-svh items-end">
        <div className="w-full">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof MessageInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Wrapper(args: Partial<React.ComponentProps<typeof MessageInput>>) {
  const [value, setValue] = useState(args.value ?? "");
  return (
    <MessageInput
      {...args}
      value={value}
      onChange={setValue}
      onSubmit={() => {
        alert(`Sent: ${value}`);
        setValue("");
      }}
    />
  );
}

const noopArgs = {
  value: "",
  onChange: () => {},
  onSubmit: () => {},
} satisfies React.ComponentProps<typeof MessageInput>;

export const Empty: Story = {
  args: noopArgs,
  render: () => <Wrapper />,
};

export const WithText: Story = {
  args: noopArgs,
  render: () => <Wrapper value="What is the chunking strategy used by the pipeline?" />,
};

export const Disabled: Story = {
  args: { ...noopArgs, disabled: true },
  render: () => <Wrapper value="" disabled />,
};
