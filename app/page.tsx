import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <main className="bg-background flex min-h-svh flex-col">
      <header className="flex h-14 items-center px-6">
        <Link href="/" className="font-semibold tracking-tight">
          DocuMind <span className="text-primary">AI</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Talk to your documents.
          </h1>
          <p className="text-muted-foreground mt-6 text-lg">
            DocuMind AI ingests your PDFs, builds a vector index, and answers questions in natural
            language — every answer linked to the exact source page.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">Create free account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="text-muted-foreground border-border border-t px-6 py-4 text-xs">
        <div className="flex justify-between">
          <span>© DocuMind AI</span>
          <span>Multi-tenant RAG · Powered by pgvector + OpenAI</span>
        </div>
      </footer>
    </main>
  );
}
