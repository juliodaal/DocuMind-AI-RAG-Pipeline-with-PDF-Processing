import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Landing() {
  return (
    <main className="bg-background flex min-h-svh flex-col">
      <header className="flex h-14 items-center px-5">
        <Link href="/" className="font-mono text-[15px]">
          <span className="text-foreground">d</span>
          <span className="text-foreground/40">ocumind</span>
          <span className="text-primary">.</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="font-mono text-[12px]">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="font-mono text-[12px]">
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="ds-eyebrow">retrieval-augmented generation</span>
          <h1 className="mt-3 text-[clamp(36px,7vw,68px)] leading-[1.05] font-black tracking-tight">
            Talk to your <span className="text-primary">documents</span>.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-[15px] leading-relaxed">
            DocuMind ingests your PDFs, builds a vector index, and answers questions in natural
            language — every claim linked to the exact source page.
          </p>
          <div className="mt-9 flex justify-center gap-2">
            <Button asChild size="lg" className="font-mono text-[12px]">
              <Link href="/signup">Create free account →</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-mono text-[12px]">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>

          <ul className="text-muted-foreground mx-auto mt-14 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              { eyebrow: "01", title: "Hybrid search", desc: "Vector + BM25 fused via RRF." },
              { eyebrow: "02", title: "Inline citations", desc: "Click [n] to verify the source." },
              {
                eyebrow: "03",
                title: "Multi-tenant",
                desc: "Postgres RLS isolates workspaces.",
              },
            ].map((f) => (
              <li key={f.eyebrow} className="border-border bg-card/40 rounded-[10px] border p-4">
                <div className="ds-label mb-2">{f.eyebrow}</div>
                <div className="text-foreground text-[13px] font-medium">{f.title}</div>
                <div className="text-muted-foreground mt-1 text-[12px]">{f.desc}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-border text-muted-foreground border-t px-5 py-4 font-mono text-[10px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span>© DocuMind AI</span>
          <span className="hidden sm:inline">multi-tenant rag · pgvector · openai gpt-4o-mini</span>
        </div>
      </footer>
    </main>
  );
}
