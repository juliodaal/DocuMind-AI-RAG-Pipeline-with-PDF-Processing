import type { Preview } from "@storybook/nextjs-vite";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#0E0F11" },
        { name: "light", value: "#FAFAFA" },
      ],
    },
    options: {
      storySort: {
        order: ["Foundation", "Primitives", "Chat", "Documents", "Workspace"],
      },
    },
    a11y: { test: "todo" },
    docs: {
      toc: true,
    },
  },
  globalTypes: {
    theme: {
      description: "Theme",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark", icon: "circle" },
          { value: "light", title: "Light", icon: "sun" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark" },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme as string;
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);
      }
      return Story();
    },
  ],
};

export default preview;
