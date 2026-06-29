-- Tokens + campaña live en profiles (ejecutar después de supabase_plans.sql)
-- Idempotente — no borra datos.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tokens_balance INT NOT NULL DEFAULT 10000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tokens_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS campaign_live_used BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.profiles
SET tokens_balance = 10000
WHERE plan = 'free' AND (tokens_balance IS NULL OR tokens_balance < 0);

UPDATE public.profiles
SET tokens_balance = 2000000,
    tokens_period_start = timezone('utc'::text, now())
WHERE plan = 'pro' AND tokens_balance < 2000000;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, plan, tokens_balance, tokens_period_start)
  VALUES (NEW.id, 'free', 10000, timezone('utc'::text, now()))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
