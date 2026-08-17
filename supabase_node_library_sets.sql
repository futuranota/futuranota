-- Document (node) library sets — packs of fichas on each node row.
-- Items stay in `library_items`; `setId` on each item points at a set (null = loose).
-- Run in Supabase SQL Editor before deploying app code that upserts this column.

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS library_sets JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
