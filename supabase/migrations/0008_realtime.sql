-- Enable Realtime for the documents table so the dashboard reflects status
-- changes (uploading → queued → processing → ready) without polling.
-- Realtime respects RLS — users only receive events for rows they can SELECT.

alter publication supabase_realtime add table public.documents;
