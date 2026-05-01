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

  // Server Actions are passed as bound props so client components can call them
  const createSession = createUploadSessionAction.bind(null, workspaceId);
  const confirmUpload = confirmUploadAction.bind(null, workspaceId);
  const deleteDoc = deleteDocumentAction.bind(null, workspaceId);
  const reprocess = reprocessDocumentAction.bind(null, workspaceId);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm">
          Upload PDFs to build the knowledge base for {org.name}.
        </p>
      </header>

      <UploadZone
        workspaceId={workspaceId}
        onCreateUploadSession={createSession}
        onConfirmUpload={confirmUpload}
      />

      <DocumentList
        workspaceId={workspaceId}
        initialDocuments={documents}
        onDeleteDocument={deleteDoc}
        onReprocessDocument={reprocess}
      />
    </div>
  );
}
