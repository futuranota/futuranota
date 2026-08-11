-- Management Users v3: active/inactive for quota pool (e.g. Supabase storage)
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quota_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.quota_active IS
  'Admin Feature usage toggle. Inactive users are excluded from pooled storage (Supabase meter Used).';
