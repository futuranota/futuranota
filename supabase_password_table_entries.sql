-- Password table entries — per-user, scoped to company (object_id).
-- One row per password. Run in Supabase SQL Editor after supabase_persistence_user_scope.sql
--
-- NOTE: object_id is NOT a FK to companies — same reason as url_table_entries.

CREATE TABLE IF NOT EXISTS public.password_table_entries (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id VARCHAR(50),
  description TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS password_table_entries_user_id_idx ON public.password_table_entries (user_id);
CREATE INDEX IF NOT EXISTS password_table_entries_object_id_idx ON public.password_table_entries (object_id);
CREATE INDEX IF NOT EXISTS password_table_entries_user_object_idx ON public.password_table_entries (user_id, object_id);

ALTER TABLE public.password_table_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "password_table_entries_owner_all" ON public.password_table_entries;
CREATE POLICY "password_table_entries_owner_all" ON public.password_table_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
