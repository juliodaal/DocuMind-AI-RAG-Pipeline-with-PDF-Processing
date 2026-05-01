import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-6">
      <Link
        href="/"
        className="text-foreground mb-8 text-xl font-semibold tracking-tight"
        aria-label="DocuMind AI home"
      >
        DocuMind <span className="text-primary">AI</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
