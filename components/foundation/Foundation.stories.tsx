import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const meta = {
  title: "Foundation/Tokens",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Design tokens used across DocuMind AI. Dark-first monochrome with mint accent (#57CC99). Inter for body, Geist Mono for labels and metadata.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  render: () => {
    const swatches = [
      { name: "background", value: "var(--background)" },
      { name: "foreground", value: "var(--foreground)" },
      { name: "card", value: "var(--card)" },
      { name: "popover", value: "var(--popover)" },
      { name: "primary", value: "var(--primary)" },
      { name: "primary-foreground", value: "var(--primary-foreground)" },
      { name: "secondary", value: "var(--secondary)" },
      { name: "muted-foreground", value: "var(--muted-foreground)" },
      { name: "border", value: "var(--border)" },
      { name: "destructive", value: "var(--destructive)" },
      { name: "warn", value: "var(--warn)" },
      { name: "info", value: "var(--info)" },
    ];
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {swatches.map((s) => (
          <div key={s.name} className="space-y-1.5">
            <div
              className="border-border h-14 w-full rounded-md border"
              style={{ background: s.value }}
            />
            <div className="ds-mono">{s.name}</div>
          </div>
        ))}
      </div>
    );
  },
};

export const Typography: Story = {
  render: () => (
    <div className="border-border space-y-0 divide-y divide-[var(--border)] overflow-hidden rounded-[10px] border">
      <Row label="Display" meta="64–96 / 900" sample="Talk to your documents.">
        <p className="text-[clamp(36px,5vw,56px)] leading-[1.05] font-black tracking-tight">
          Talk to your documents.
        </p>
      </Row>
      <Row label="H1" meta="32 / 900" sample="Documents library">
        <p className="text-[30px] font-black tracking-tight">Documents library</p>
      </Row>
      <Row label="H2" meta="22 / 600" sample="Recent conversations">
        <p className="text-[22px] font-semibold">Recent conversations</p>
      </Row>
      <Row label="H3" meta="15 / 600" sample="Active sources">
        <p className="text-[15px] font-semibold">Active sources</p>
      </Row>
      <Row label="Body" meta="14 / 400" sample="DocuMind ingests…">
        <p className="text-[14px] leading-relaxed">
          DocuMind ingests your PDFs, builds a vector index, and answers in natural language.
        </p>
      </Row>
      <Row label="Body SM" meta="12 / 400" sample="Last synced 2m ago">
        <p className="text-muted-foreground text-[12px]">Last synced 2m ago · 14 chunks</p>
      </Row>
      <Row label="Mono" meta="12 / 400" sample="const a = await ai.run()">
        <p className="font-mono text-[12px]">const a = await ai.run(query)</p>
      </Row>
      <Row label="Eyebrow" meta="10 / 500 +0.15em" sample="WORKSPACE · LIBRARY">
        <p className="ds-eyebrow">workspace · library</p>
      </Row>
    </div>
  ),
};

export const Radius: Story = {
  render: () => {
    const items = [
      { tok: "--radius-sm", val: "4px", px: 4 },
      { tok: "--radius-md", val: "6px", px: 6 },
      { tok: "--radius-lg", val: "10px", px: 10 },
      { tok: "--radius-xl", val: "16px", px: 16 },
    ];
    return (
      <div className="flex flex-wrap items-end gap-4">
        {items.map((r) => (
          <div key={r.tok} className="flex flex-col items-center gap-2">
            <div
              className="border-primary/25 bg-primary/5 size-16 border"
              style={{ borderRadius: r.px }}
            />
            <div className="ds-mono text-center">
              {r.tok}
              <br />
              {r.val}
            </div>
          </div>
        ))}
      </div>
    );
  },
};

export const Spacing: Story = {
  render: () => (
    <div className="space-y-2">
      {[4, 8, 12, 16, 24, 32, 48].map((px) => (
        <div key={px} className="flex items-center gap-3">
          <div className="ds-mono w-12 text-right">{px}px</div>
          <div className="bg-primary/15 border-primary/25 h-3 border" style={{ width: px * 4 }} />
          <div className="ds-mono">sp-{px / 4}</div>
        </div>
      ))}
    </div>
  ),
};

function Row({
  label,
  meta,
  children,
}: {
  label: string;
  meta: string;
  sample: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-6 px-5 py-4">
      <div className="w-24 shrink-0">
        <div className="text-[12px] font-medium">{label}</div>
        <div className="ds-mono">{meta}</div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
