"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/require-org";
import { createUploadSession, getDocument, markQueued } from "@/lib/db/queries/documents";
import { createAdminClient } from "@/lib/auth/admin";
import { deleteObject } from "@/lib/storage/supabase";
import { validateUpload } from "@/lib/storage/keys";
import { inngest } from "@/lib/inngest/client";

const createSessionSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export async function createUploadSessionAction(
  workspaceId: string,
  input: z.infer<typeof createSessionSchema>,
) {
  const { user, org } = await requireOrg(workspaceId);

  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid upload request");

  const v = validateUpload(parsed.data.filename, parsed.data.mimeType, parsed.data.sizeBytes);
  if (!v.ok) throw new Error(v.reason);

  return await createUploadSession({
    orgId: org.id,
    uploaderId: user.id,
    filename: parsed.data.filename,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
  });
}

export async function confirmUploadAction(workspaceId: string, documentId: string) {
  const { user, org } = await requireOrg(workspaceId);

  // Verify the document belongs to this org and was uploaded by this user
  const doc = await getDocument(org.id, documentId);
  if (!doc) throw new Error("Document not found");
  if (doc.uploader_id !== user.id) throw new Error("Not allowed to confirm this upload");
  if (doc.status !== "uploading") throw new Error(`Document is in status ${doc.status}`);

  await markQueued(documentId);

  await inngest.send({
    name: "document/uploaded",
    data: {
      documentId,
      orgId: org.id,
      uploaderId: user.id,
    },
  });

  revalidatePath(`/w/${workspaceId}/documents`);
}

export async function deleteDocumentAction(workspaceId: string, documentId: string) {
  const { org } = await requireOrg(workspaceId);

  const doc = await getDocument(org.id, documentId);
  if (!doc) throw new Error("Document not found");

  // Best-effort: remove from Storage first, then DB row (chunks cascade-delete)
  try {
    await deleteObject(doc.storage_path);
  } catch (err) {
    console.warn("[delete] storage removal failed", err);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("org_id", org.id);
  if (error) throw new Error(`Failed to delete document: ${error.message}`);

  revalidatePath(`/w/${workspaceId}/documents`);
}

export async function reprocessDocumentAction(workspaceId: string, documentId: string) {
  const { user, org } = await requireOrg(workspaceId);

  const doc = await getDocument(org.id, documentId);
  if (!doc) throw new Error("Document not found");
  if (doc.status === "processing") throw new Error("Already processing");

  await markQueued(documentId);

  await inngest.send({
    name: "document/uploaded",
    data: { documentId, orgId: org.id, uploaderId: user.id },
  });

  revalidatePath(`/w/${workspaceId}/documents`);
}
