-- Management Users v2: track first Free → Pro transition
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_upgraded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.plan_upgraded_at IS
  'First transition from free/starter to pro (UTC). Null if never upgraded.';
