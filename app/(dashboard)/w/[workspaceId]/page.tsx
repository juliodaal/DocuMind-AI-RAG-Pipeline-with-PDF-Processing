import Link from "next/link";
import { requireOrg } from "@/lib/auth/require-org";
import { listDocumentsForOrg } from "@/lib/db/queries/documents";
import { listConversationsForUser } from "@/lib/db/queries/conversations";
import { Button } from "@/components/ui/button";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { org, user } = await requireOrg(workspaceId);

  const [documents, conversations] = await Promise.all([
    listDocumentsForOrg(org.id),
    listConversationsForUser(org.id, user.id, 5),
  ]);

  const ready = documents.filter((d) => d.status === "ready").length;
  const processing = documents.filter((d) => ["queued", "processing"].includes(d.status)).length;
  const totalPages = documents.reduce((a, d) => a + (d.page_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="ds-page-header">
        <span className="ds-eyebrow">workspace · {org.role}</span>
        <h1 className="ds-page-title">{org.name}</h1>
        <p className="ds-page-sub">{user.email}</p>
      </header>

      <section className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Documents" value={documents.length} />
        <Metric label="Ready" value={ready} accent />
        <Metric label="Processing" value={processing} />
        <Metric label="Pages indexed" value={totalPages} />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ActionCard
          eyebrow="upload"
          title="Add a document"
          desc="Drop a PDF and it gets parsed, chunked, embedded, and indexed automatically."
          href={`/w/${workspaceId}/documents`}
          cta="Open library"
        />
        <ActionCard
          eyebrow="ask"
          title="Start a conversation"
          desc="Ask a question — DocuMind picks the most relevant excerpts and answers with cited sources."
          href={`/w/${workspaceId}/chat`}
          cta="Open chat"
          accent
        />
      </section>

      {conversations.length > 0 && (
        <section className="mt-12">
          <h2 className="ds-section-title">Recent conversations</h2>
          <ul className="border-border divide-border divide-y overflow-hidden rounded-[10px] border">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/w/${workspaceId}/chat/${c.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-[13px] transition-colors hover:bg-white/[0.02]"
                >
                  <span className="truncate font-mono">{c.title ?? "Untitled chat"}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="border-border bg-card/40 hover:border-border/80 rounded-[10px] border px-4 py-4 transition-all hover:-translate-y-0.5">
      <div
        className={`mb-1.5 text-[28px] leading-none font-black ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="ds-label">{label}</div>
    </div>
  );
}

function ActionCard({
  eyebrow,
  title,
  desc,
  href,
  cta,
  accent,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`group flex flex-col gap-3 rounded-[10px] border p-5 transition-all hover:-translate-y-0.5 ${
        accent
          ? "border-primary/25 bg-primary/[0.04] hover:bg-primary/[0.06]"
          : "border-border bg-card/40 hover:border-border/80"
      }`}
    >
      <span className={`ds-label ${accent ? "text-primary/70" : ""}`}>{eyebrow}</span>
      <h3 className="text-[18px] font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-[13px] leading-relaxed">{desc}</p>
      <div className="mt-1">
        <Button
          asChild
          variant={accent ? "default" : "outline"}
          size="sm"
          className="font-mono text-[11px]"
        >
          <Link href={href}>{cta} →</Link>
        </Button>
      </div>
    </div>
  );
}
