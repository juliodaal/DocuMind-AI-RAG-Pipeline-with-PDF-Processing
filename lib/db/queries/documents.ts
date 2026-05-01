import { createClient as createSupabaseServer } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/auth/admin";
import { documentKey } from "@/lib/storage/keys";
import { getSignedUploadUrl } from "@/lib/storage/supabase";
import type { Document, DocumentStatus } from "@/lib/db/types";

/**
 * Create a document row in 'uploading' state and return a signed upload URL.
 * Should be called from a Server Action that has already validated org membership
 * via requireOrg().
 */
export async function createUploadSession(args: {
  orgId: string;
  uploaderId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const admin = createAdminClient();

  const { data: doc, error } = await admin
    .from("documents")
    .insert({
      org_id: args.orgId,
      uploader_id: args.uploaderId,
      filename: args.filename,
      mime_type: args.mimeType,
      size_bytes: args.sizeBytes,
      storage_path: "", // filled in below once we know the doc id
      status: "uploading" as DocumentStatus,
    })
    .select()
    .single();

  if (error || !doc) throw new Error(`Failed to create document: ${error?.message ?? "unknown"}`);

  const path = documentKey(args.orgId, doc.id, args.filename);

  const { error: pathError } = await admin
    .from("documents")
    .update({ storage_path: path })
    .eq("id", doc.id);
  if (pathError) throw new Error(`Failed to set storage_path: ${pathError.message}`);

  const upload = await getSignedUploadUrl(path);

  return {
    documentId: doc.id as string,
    uploadUrl: upload.uploadUrl,
    token: upload.token,
    path,
  };
}

/**
 * Mark a document as queued for ingestion.
 */
export async function markQueued(documentId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("documents")
    .update({ status: "queued" satisfies DocumentStatus })
    .eq("id", documentId);
  if (error) throw new Error(`Failed to mark queued: ${error.message}`);
}

/**
 * Update status fields on a document. Used by the ingestion worker.
 */
export async function updateDocumentStatus(
  documentId: string,
  patch: {
    status?: DocumentStatus;
    error?: string | null;
    page_count?: number | null;
    sha256?: string | null;
    processed_at?: string | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("documents").update(patch).eq("id", documentId);
  if (error) throw new Error(`Failed to update document: ${error.message}`);
}

/**
 * List documents in an org. Uses the user's session — RLS enforces org membership.
 */
export async function listDocumentsForOrg(orgId: string, limit = 50): Promise<Document[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Document[];
}

/**
 * Fetch a single document scoped to an org (RLS enforces membership).
 */
export async function getDocument(orgId: string, documentId: string): Promise<Document | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as Document | null;
}
