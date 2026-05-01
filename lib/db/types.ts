/**
 * Hand-rolled types mirroring the database schema.
 * For a richer flow we'd run `supabase gen types typescript` — but these are sufficient
 * for our query helpers and avoid an extra build step.
 *
 * Keep in sync with supabase/migrations/.
 */

export type DocumentStatus = "uploading" | "queued" | "processing" | "ready" | "failed";

export type OrgRole = "owner" | "admin" | "member";

export type OrgPlan = "free" | "pro" | "enterprise";

export type UsageKind = "embedding" | "chat" | "rerank" | "auto_title";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: OrgPlan;
  created_at: string;
};

export type OrganizationMember = {
  org_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
};

export type Document = {
  id: string;
  org_id: string;
  uploader_id: string | null;
  filename: string;
  mime_type: string;
  storage_path: string;
  size_bytes: number;
  sha256: string | null;
  status: DocumentStatus;
  error: string | null;
  page_count: number | null;
  created_at: string;
  processed_at: string | null;
};

export type DocumentChunk = {
  id: string;
  document_id: string;
  org_id: string;
  chunk_index: number;
  content: string;
  embedding: number[] | null;
  page_number: number | null;
  token_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UsageEvent = {
  id: string;
  org_id: string;
  user_id: string | null;
  kind: UsageKind;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_cents: number;
  metadata: Record<string, unknown>;
  created_at: string;
};
