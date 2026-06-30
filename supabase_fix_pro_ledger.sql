-- Repara perfiles Pro con saldo de tokens de Free (10_000 = 1 crédito).
-- Pro correcto: tokens_balance = 2_000_000 (200 créditos × 10k).
-- Idempotente — ejecutar en Supabase SQL Editor.

UPDATE public.profiles
SET
  tokens_balance = 2000000,
  tokens_period_start = timezone('utc'::text, now()),
  search_count = 0,
  updated_at = timezone('utc'::text, now())
WHERE plan = 'pro'
  AND tokens_balance < 2000000;

NOTIFY pgrst, 'reload schema';
