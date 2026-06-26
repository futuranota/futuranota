-- Estudios de campaña cacheados por usuario (live run + frozen snapshot)
-- Ejecutar después de supabase_plans_tokens.sql

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

NOTIFY pgrst, 'reload schema';
