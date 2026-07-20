-- URL tables (multi-table per company) + table_id on entries.
-- Run in Supabase SQL Editor after supabase_url_table_entries.sql
-- and supabase_url_table_entries_tag_category.sql

CREATE TABLE IF NOT EXISTS public.url_tables (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id VARCHAR(50),
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS url_tables_user_id_idx ON public.url_tables (user_id);
CREATE INDEX IF NOT EXISTS url_tables_object_id_idx ON public.url_tables (object_id);
CREATE INDEX IF NOT EXISTS url_tables_user_object_idx ON public.url_tables (user_id, object_id);

ALTER TABLE public.url_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "url_tables_owner_all" ON public.url_tables;
CREATE POLICY "url_tables_owner_all" ON public.url_tables
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.url_table_entries
  ADD COLUMN IF NOT EXISTS table_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS url_table_entries_table_id_idx
  ON public.url_table_entries (table_id);

-- Backfill: one default table per (user_id, object_id) for orphan entries
DO $$
DECLARE
  r RECORD;
  new_id TEXT;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id, object_id
    FROM public.url_table_entries
    WHERE table_id IS NULL OR table_id = ''
  LOOP
    new_id := 'URLT' || substr(md5(random()::text || clock_timestamp()::text || coalesce(r.object_id, '')), 1, 24);
    INSERT INTO public.url_tables (id, user_id, object_id, title)
    VALUES (new_id, r.user_id, r.object_id, 'URL table');

    UPDATE public.url_table_entries e
    SET table_id = new_id
    WHERE e.user_id = r.user_id
      AND e.object_id IS NOT DISTINCT FROM r.object_id
      AND (e.table_id IS NULL OR e.table_id = '');
  END LOOP;
END $$;
