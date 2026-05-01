"use client";

import { useEffect, useRef } from "react";
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
      className="border-border bg-background/85 sticky bottom-0 border-t backdrop-blur-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <div className="mx-auto max-w-3xl px-4 py-3.5">
        <div className="border-input bg-card focus-within:border-primary/35 focus-within:ring-primary/12 flex items-end gap-2 rounded-[10px] border px-3 py-2 transition-shadow focus-within:ring-[3px]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className={cn(
              "placeholder:text-muted-foreground/70 flex max-h-[180px] min-h-[24px] w-full resize-none bg-transparent p-0 text-[13px] outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={disabled || !value.trim()}
            className="size-7 shrink-0 rounded-md"
            aria-label="Send message"
            variant="default"
          >
            <SendIcon />
          </Button>
        </div>
        <p className="text-muted-foreground/70 mt-2 text-center font-mono text-[10px]">
          <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
        </p>
      </div>
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
