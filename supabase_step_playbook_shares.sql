-- Public step-by-step playbook shares (snapshot + opaque token).
-- Run once in Supabase SQL Editor. Then: NOTIFY pgrst, 'reload schema';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.step_playbook_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_doc_id TEXT NOT NULL,
  source_block_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_name TEXT NOT NULL DEFAULT '',
  author_initial TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT step_playbook_shares_token_unique UNIQUE (token),
  CONSTRAINT step_playbook_shares_source_unique UNIQUE (user_id, source_doc_id, source_block_id)
);

CREATE INDEX IF NOT EXISTS step_playbook_shares_token_idx
  ON public.step_playbook_shares (token);

CREATE INDEX IF NOT EXISTS step_playbook_shares_user_idx
  ON public.step_playbook_shares (user_id);

ALTER TABLE public.step_playbook_shares ENABLE ROW LEVEL SECURITY;

-- Anyone with the token can read the snapshot (token is the secret).
DROP POLICY IF EXISTS "step_playbook_shares_select_public" ON public.step_playbook_shares;
CREATE POLICY "step_playbook_shares_select_public" ON public.step_playbook_shares
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "step_playbook_shares_insert_own" ON public.step_playbook_shares;
CREATE POLICY "step_playbook_shares_insert_own" ON public.step_playbook_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_playbook_shares_update_own" ON public.step_playbook_shares;
CREATE POLICY "step_playbook_shares_update_own" ON public.step_playbook_shares
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_playbook_shares_delete_own" ON public.step_playbook_shares;
CREATE POLICY "step_playbook_shares_delete_own" ON public.step_playbook_shares
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
