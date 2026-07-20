-- URL table entries — per-user, scoped to company (object_id).
-- One row per link. Run in Supabase SQL Editor after supabase_persistence_user_scope.sql
--
-- NOTE: object_id is NOT a FK to companies — local object ids may exist before
-- companies rows sync, and a FK would silently block every upsert.

CREATE TABLE IF NOT EXISTS public.url_table_entries (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id VARCHAR(50),
  name TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  table_id VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS url_table_entries_user_id_idx ON public.url_table_entries (user_id);
CREATE INDEX IF NOT EXISTS url_table_entries_object_id_idx ON public.url_table_entries (object_id);
CREATE INDEX IF NOT EXISTS url_table_entries_user_object_idx ON public.url_table_entries (user_id, object_id);
CREATE INDEX IF NOT EXISTS url_table_entries_table_id_idx ON public.url_table_entries (table_id);

ALTER TABLE public.url_table_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "url_table_entries_owner_all" ON public.url_table_entries;
CREATE POLICY "url_table_entries_owner_all" ON public.url_table_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
