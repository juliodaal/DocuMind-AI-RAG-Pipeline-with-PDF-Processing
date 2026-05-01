import { requireOrg } from "@/lib/auth/require-org";
import { listDocumentsForOrg } from "@/lib/db/queries/documents";
import { UploadZone } from "@/components/documents/UploadZone";
import { DocumentList } from "@/components/documents/DocumentList";
import {
  createUploadSessionAction,
  confirmUploadAction,
  deleteDocumentAction,
  reprocessDocumentAction,
} from "./actions";

export const metadata = {
  title: "Documents",
};

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { org } = await requireOrg(workspaceId);
  const documents = await listDocumentsForOrg(org.id);

  const createSession = createUploadSessionAction.bind(null, workspaceId);
  const confirmUpload = confirmUploadAction.bind(null, workspaceId);
  const deleteDoc = deleteDocumentAction.bind(null, workspaceId);
  const reprocess = reprocessDocumentAction.bind(null, workspaceId);

  const readyCount = documents.filter((d) => d.status === "ready").length;
  const totalChunks = documents.reduce((acc, d) => acc + (d.page_count ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="ds-page-header flex items-end justify-between gap-4">
        <div>
          <span className="ds-eyebrow">workspace · library</span>
          <h1 className="ds-page-title">Documents</h1>
          <p className="ds-page-sub">
            {readyCount} ready · {documents.length} total · ~{totalChunks} pages indexed
          </p>
        </div>
      </header>

      <section className="space-y-8">
        <UploadZone
          workspaceId={workspaceId}
          onCreateUploadSession={createSession}
          onConfirmUpload={confirmUpload}
        />

        <div>
          <h2 className="ds-section-title">Library</h2>
          <DocumentList
            workspaceId={workspaceId}
            initialDocuments={documents}
            onDeleteDocument={deleteDoc}
            onReprocessDocument={reprocess}
          />
        </div>
      </section>
    </div>
  );
}
