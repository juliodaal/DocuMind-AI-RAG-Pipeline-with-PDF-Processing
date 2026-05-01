import { createAdminClient } from "@/lib/auth/admin";
import { STORAGE_BUCKET } from "@/lib/storage/keys";

/**
 * Server-side helpers for Supabase Storage.
 * All operations use the service role to bypass RLS — RLS is enforced separately
 * at the Server Action layer via requireOrg().
 */

export type SignedUploadResult = {
  /** URL the browser PUTs to. */
  uploadUrl: string;
  /** Token included in the URL — needed only if you reconstruct manually. */
  token: string;
  /** The path inside the bucket. */
  path: string;
};

/**
 * Generate a one-time signed upload URL for a path inside the bucket.
 * The URL is valid for ~2 hours (Supabase default for signed uploads).
 */
export async function getSignedUploadUrl(path: string): Promise<SignedUploadResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Failed to sign upload URL: ${error.message}`);
  return { uploadUrl: data.signedUrl, token: data.token, path: data.path };
}

/**
 * Generate a temporary download URL for a stored object.
 * Default expiry: 5 minutes. Use a short expiry for sensitive content.
 */
export async function getSignedDownloadUrl(path: string, expiresInSec = 300): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`Failed to sign download URL: ${error.message}`);
  return data.signedUrl;
}

/**
 * Download an object as a Blob. Used by the ingestion worker.
 */
export async function downloadObject(path: string): Promise<Blob> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error) throw new Error(`Failed to download object: ${error.message}`);
  return data;
}

/**
 * Hard-delete an object from storage.
 */
export async function deleteObject(path: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw new Error(`Failed to delete object: ${error.message}`);
}
