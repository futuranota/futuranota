-- Folder library fichas (metadata) on each folder/campaign row.
-- Bytes (images/video/attachments) stay in Storage bucket `doc-images`.
-- Run in Supabase SQL Editor before deploying app code that upserts this column.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS library_items JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
