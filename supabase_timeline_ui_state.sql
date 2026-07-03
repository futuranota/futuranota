-- Timeline UI state (doc queue, snapshots, expanded docs) — one row per user.
-- Run in Supabase SQL editor after supabase_persistence_user_scope.sql

CREATE TABLE IF NOT EXISTS public.user_timeline_ui (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_timeline_ui ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_timeline_ui_owner_all" ON public.user_timeline_ui;
CREATE POLICY "user_timeline_ui_owner_all" ON public.user_timeline_ui
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
