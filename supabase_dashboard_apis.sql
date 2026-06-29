-- Dashboard APIs — migración combinada (paso 6 / Supabase)
-- ORDEN:
--   1) supabase_plans.sql  (crea tabla profiles — obligatorio si verify:apis falla en step 6)
--   2) Este archivo (tokens + campaign_studies + weather_cache)
-- Verificación: npm run verify:apis

-- ── Tokens en profiles ─────────────────────────────────────────────────────
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

-- ── campaign_studies (cache estudio live) ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.campaign_studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    keyword TEXT,
    campaign_status TEXT CHECK (campaign_status IN ('ACTIVA', 'INACTIVA', 'EMERGENTE')),
    campaign_active BOOLEAN NOT NULL DEFAULT FALSE,
    overview TEXT,
    note TEXT,
    people_also_ask JSONB NOT NULL DEFAULT '[]'::jsonb,
    social_hype JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_intent JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT,
    live_run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (user_id, brand_name)
);

CREATE INDEX IF NOT EXISTS campaign_studies_user_brand_idx
  ON public.campaign_studies (user_id, brand_name);

ALTER TABLE public.campaign_studies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own campaign studies" ON public.campaign_studies;
DROP POLICY IF EXISTS "insert own campaign studies" ON public.campaign_studies;
DROP POLICY IF EXISTS "update own campaign studies" ON public.campaign_studies;

CREATE POLICY "select own campaign studies" ON public.campaign_studies
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert own campaign studies" ON public.campaign_studies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own campaign studies" ON public.campaign_studies
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── weather_cache (OpenWeather TTL ~45 min) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weather_cache (
    cache_key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read weather cache" ON public.weather_cache;
DROP POLICY IF EXISTS "write weather cache service" ON public.weather_cache;

CREATE POLICY "read weather cache" ON public.weather_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "write weather cache service" ON public.weather_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
