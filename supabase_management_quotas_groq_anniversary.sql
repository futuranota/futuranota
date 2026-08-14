-- Lock Groq meters to monthly anniversary (seed day 20).
-- Idempotent. Run in Supabase SQL Editor if live Groq rows are still every/day
-- or have the wrong anchor.
-- Replace '2026-02-20' below if the account signup day-of-month differs.

UPDATE public.admin_quota_meters
SET every_n = 1,
    every_unit = 'month',
    anchor_at = '2026-02-20',  -- or your real signup YYYY-MM-DD
    updated_at = timezone('utc', now())
WHERE provider = 'groq';
