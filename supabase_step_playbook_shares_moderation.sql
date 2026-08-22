-- Step playbook share moderation (request → admin approve).
-- Run in Supabase SQL Editor after supabase_step_playbook_shares.sql.
-- Then: NOTIFY pgrst, 'reload schema';

ALTER TABLE public.step_playbook_shares
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

-- Grandfather existing live shares as published.
UPDATE public.step_playbook_shares
SET status = 'published',
    reviewed_at = COALESCE(reviewed_at, updated_at, created_at)
WHERE status IS NULL;

UPDATE public.step_playbook_shares
SET requested_at = COALESCE(requested_at, created_at)
WHERE requested_at IS NULL;

ALTER TABLE public.step_playbook_shares
  ALTER COLUMN status SET DEFAULT 'requested';

UPDATE public.step_playbook_shares
SET status = 'requested'
WHERE status IS NULL;

ALTER TABLE public.step_playbook_shares
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'step_playbook_shares_status_check'
  ) THEN
    ALTER TABLE public.step_playbook_shares
      ADD CONSTRAINT step_playbook_shares_status_check
      CHECK (status IN ('requested', 'published', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS step_playbook_shares_status_idx
  ON public.step_playbook_shares (status);

-- Replace open public SELECT with published-only for anon + owner/admin patterns.
DROP POLICY IF EXISTS "step_playbook_shares_select_public" ON public.step_playbook_shares;
DROP POLICY IF EXISTS "step_playbook_shares_select_anon_published" ON public.step_playbook_shares;
DROP POLICY IF EXISTS "step_playbook_shares_select_authenticated" ON public.step_playbook_shares;

-- Anon: only published snapshots (token still the secret).
CREATE POLICY "step_playbook_shares_select_anon_published" ON public.step_playbook_shares
  FOR SELECT
  TO anon
  USING (status = 'published');

-- Authenticated: owners see own rows; admin queue needs all (app gates via VITE_ADMIN_EMAIL).
CREATE POLICY "step_playbook_shares_select_authenticated" ON public.step_playbook_shares
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated updates (admin Accept/Reject). App gates to VITE_ADMIN_EMAIL.
-- Owners can still update own rows via this policy (same pattern as signal_campaigns).
DROP POLICY IF EXISTS "step_playbook_shares_update_own" ON public.step_playbook_shares;
DROP POLICY IF EXISTS "step_playbook_shares_update_authenticated" ON public.step_playbook_shares;
CREATE POLICY "step_playbook_shares_update_authenticated" ON public.step_playbook_shares
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
