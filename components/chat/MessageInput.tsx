"use client";

import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Ask a question about your documents…",
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize: grow up to ~6 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  return (
    <form
      className="border-border bg-background/80 sticky bottom-0 border-t backdrop-blur-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-4">
        <div
          className={cn(
            "border-input bg-card focus-within:ring-ring/50 focus-within:border-ring flex flex-1 items-end gap-2 rounded-2xl border px-3 py-2 shadow-sm transition-shadow focus-within:ring-2",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="max-h-[180px] min-h-[28px] resize-none border-0 bg-transparent p-0 px-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={disabled || !value.trim()}
            className="size-7 shrink-0 rounded-full"
            aria-label="Send message"
          >
            <SendIcon />
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground/70 -mt-1 px-4 pb-2 text-center text-[10px]">
        Press <kbd className="font-mono">Enter</kbd> to send ·{" "}
        <kbd className="font-mono">Shift</kbd>+<kbd className="font-mono">Enter</kbd> for new line
      </p>
    </form>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="m5 12 14-7-7 14-2-5-5-2z" />
    </svg>
  );
}
