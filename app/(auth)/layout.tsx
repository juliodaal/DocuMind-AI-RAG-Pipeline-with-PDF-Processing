import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background relative flex min-h-svh flex-col items-center justify-center p-6">
      <Link href="/" className="font-mono text-[15px] tracking-tight" aria-label="DocuMind AI home">
        <span className="text-foreground">d</span>
        <span className="text-foreground/40">ocumind</span>
        <span className="text-primary">.</span>
      </Link>
      <div className="text-muted-foreground mt-2 mb-8 font-mono text-[10px] tracking-[0.15em] uppercase">
        retrieval-augmented generation
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
