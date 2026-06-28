-- Calendar monthly counter + optional admin credit reset
-- Run in Supabase SQL Editor (idempotent).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_searches_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_period_start TIMESTAMPTZ;

-- Reset Pro credits for admin (replace email before running):
-- UPDATE public.profiles
-- SET
--   plan = 'pro',
--   tokens_balance = 1500000,
--   tokens_period_start = timezone('utc', now()),
--   search_count = 0,
--   calendar_used = false,
--   calendar_searches_count = 0,
--   calendar_period_start = timezone('utc', now())
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'contact.fnota@gmail.com' LIMIT 1
-- );

NOTIFY pgrst, 'reload schema';
