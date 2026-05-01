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
      className="border-border bg-background sticky bottom-0 border-t"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim()) onSubmit();
      }}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-4">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className={cn(
            "max-h-[180px] min-h-[40px] flex-1 resize-none",
            "focus-visible:ring-1 focus-visible:ring-offset-0",
          )}
        />
        <Button type="submit" size="default" disabled={disabled || !value.trim()}>
          Send
        </Button>
      </div>
    </form>
  );
}
