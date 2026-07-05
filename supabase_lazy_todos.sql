-- Lazy to do items — per-user, scoped to company (object_id).
-- Run in Supabase SQL Editor after supabase_persistence_user_scope.sql

CREATE TABLE IF NOT EXISTS public.lazy_todos (
  id VARCHAR(50) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_id VARCHAR(50) REFERENCES public.companies(id) ON DELETE SET NULL,
  reminder TEXT NOT NULL DEFAULT '',
  list_title TEXT NOT NULL DEFAULT 'To do',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS lazy_todos_user_id_idx ON public.lazy_todos (user_id);
CREATE INDEX IF NOT EXISTS lazy_todos_object_id_idx ON public.lazy_todos (object_id);

ALTER TABLE public.lazy_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lazy_todos_owner_all" ON public.lazy_todos;
CREATE POLICY "lazy_todos_owner_all" ON public.lazy_todos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
