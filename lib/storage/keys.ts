/**
 * Storage key conventions for the "documents" bucket.
 * Layout: {org_id}/{document_id}/{slugified-filename}
 *
 * The first path segment MUST be the org_id — Supabase Storage RLS policies
 * validate membership against it.
 */

export const STORAGE_BUCKET = "documents" as const;
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const ALLOWED_MIME_TYPES = ["application/pdf"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Slugify a filename, preserving the extension.
 * "My  Resume (final v2).PDF" → "my-resume-final-v2.pdf"
 */
export function slugifyFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.slice(lastDot + 1) : "";

  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeBase = slug || "file";
  return cleanExt ? `${safeBase}.${cleanExt}` : safeBase;
}

/**
 * Build the storage key for a document upload.
 * Returns just the path inside the bucket — does NOT include the bucket name.
 */
export function documentKey(orgId: string, documentId: string, filename: string): string {
  return `${orgId}/${documentId}/${slugifyFilename(filename)}`;
}

/**
 * Parse a storage key into its components. Returns null if malformed.
 */
export function parseDocumentKey(
  key: string,
): { orgId: string; documentId: string; filename: string } | null {
  const parts = key.split("/");
  if (parts.length < 3) return null;
  const [orgId, documentId, ...rest] = parts;
  if (!orgId || !documentId || rest.length === 0) return null;
  return { orgId, documentId, filename: rest.join("/") };
}

/**
 * Validate a file before allowing upload (defense-in-depth: also enforced server-side).
 */
export function validateUpload(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): { ok: true } | { ok: false; reason: string } {
  if (sizeBytes <= 0) return { ok: false, reason: "Empty file" };
  if (sizeBytes > MAX_FILE_BYTES) {
    return { ok: false, reason: `File exceeds ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB` };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return { ok: false, reason: `Unsupported type: ${mimeType}` };
  }
  if (!filename.trim()) return { ok: false, reason: "Filename required" };
  return { ok: true };
}
