-- Management panel: API catalog + usage event log
-- Run after supabase_plans.sql / supabase_plans_tokens.sql
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.api_integrations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  env_var TEXT,
  provider TEXT NOT NULL,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.api_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  route_label TEXT NOT NULL DEFAULT '',
  credits_debited INT NOT NULL DEFAULT 0,
  tokens_debited INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_code TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS api_usage_events_created_at_idx
  ON public.api_usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS api_usage_events_user_id_idx
  ON public.api_usage_events (user_id);

CREATE INDEX IF NOT EXISTS api_usage_events_provider_idx
  ON public.api_usage_events (provider);

CREATE INDEX IF NOT EXISTS api_usage_events_endpoint_idx
  ON public.api_usage_events (endpoint);

ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;

-- No RLS policies: anon/authenticated clients cannot read/write.
-- Server handlers use service role (bypasses RLS).

INSERT INTO public.api_integrations (id, label, env_var, provider, estimated_cost_usd, notes)
VALUES
  ('groq', 'Groq LLM', 'GROQ_API_KEY', 'groq', 0.002, 'Intel overview, campaign study, admin scans'),
  ('gemini', 'Google Gemini', 'GEMINI_API_KEY', 'gemini', 0.001, 'Optional LLM fallback'),
  ('serper', 'Serper Search', 'SERPAPI_KEY', 'serper', 0.001, 'Intel overview, horizon scan'),
  ('dataforseo', 'DataForSEO', 'DATAFORSEO_LOGIN', 'dataforseo', 0.003, 'Campaign study PAA + intent'),
  ('apify', 'Apify', 'APIFY_API_TOKEN', 'apify', 0.005, 'Campaign study social hype'),
  ('openweather', 'OpenWeather', 'OPENWEATHER_API_KEY', 'openweather', 0.0001, 'Weather forecast nodes'),
  ('supabase', 'Supabase', 'SUPABASE_PROJECT_URL', 'supabase', 0, 'Profiles, cache, persistence')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  env_var = EXCLUDED.env_var,
  provider = EXCLUDED.provider,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

-- Admin allowlist: lets /panel list all users without service role (via RPC + admin JWT).
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email TEXT PRIMARY KEY
);

CREATE OR REPLACE FUNCTION public.admin_list_users_overview()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  plan VARCHAR,
  search_count INT,
  tokens_balance INT,
  tokens_period_start TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email TEXT := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
BEGIN
  IF jwt_email = '' THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_allowlist a WHERE lower(a.email) = jwt_email
  ) THEN
    RAISE EXCEPTION 'Admin allowlist only — INSERT your email into admin_allowlist';
  END IF;
  RETURN QUERY
  SELECT
    p.user_id,
    u.email::TEXT,
    p.plan,
    p.search_count,
    p.tokens_balance,
    p.tokens_period_start,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users_overview() TO authenticated;
GRANT SELECT ON public.admin_allowlist TO authenticated;

-- Replace with your admin email (must match VITE_ADMIN_EMAIL):
-- INSERT INTO public.admin_allowlist (email) VALUES ('admin@example.com') ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
