-- Management integrations v2: lifecycle + free daily limits + expanded catalog
-- Run after supabase_management.sql
-- Idempotent — safe to re-run.

ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS daily_free_limit INT;

ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;

UPDATE public.api_integrations
SET lifecycle_status = 'active'
WHERE lifecycle_status IS NULL OR lifecycle_status = '';

ALTER TABLE public.api_integrations
  ALTER COLUMN lifecycle_status SET DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'api_integrations_lifecycle_status_check'
  ) THEN
    ALTER TABLE public.api_integrations
      ADD CONSTRAINT api_integrations_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'pending'));
  END IF;
END $$;

INSERT INTO public.api_integrations (
  id, label, env_var, provider, estimated_cost_usd, notes, daily_free_limit, lifecycle_status
)
VALUES
  ('groq', 'Groq LLM', 'GROQ_API_KEY', 'groq', 0.002, 'Intel, Gina, launch radar, campaign study, agents', NULL, 'active'),
  ('gemini', 'Google Gemini', 'GEMINI_API_KEY', 'gemini', 0.001, 'Optional LLM fallback — not in daily use', NULL, 'pending'),
  ('serper', 'Serper Search', 'SERPAPI_KEY', 'serper', 0.001, 'Intel overview, horizon scan, social hype', NULL, 'active'),
  ('dataforseo', 'DataForSEO', 'DATAFORSEO_LOGIN', 'dataforseo', 0.003, 'Campaign study PAA + intent, social hype', NULL, 'active'),
  ('apify', 'Apify', 'APIFY_API_TOKEN', 'apify', 0.005, 'Campaign study social hype', NULL, 'active'),
  ('openweather', 'OpenWeather', 'OPENWEATHER_API_KEY', 'openweather', 0.0001, 'Weather forecast nodes', 1000, 'active'),
  ('supabase', 'Supabase', 'SUPABASE_PROJECT_URL', 'supabase', 0, 'Profiles, cache, persistence — fixed plan via ledger', NULL, 'active'),
  ('calendarific', 'Calendarific', 'CALENDARIFIC_API_KEY', 'calendarific', 0.0001, 'Event calendar holidays', 100, 'active'),
  ('resend', 'Resend', 'RESEND_API_KEY', 'resend', 0, 'Referral invite emails (free tier)', 100, 'active'),
  ('predicthq', 'PredictHQ', 'PREDICTHQ_API_KEY', 'predicthq', 0.002, 'Events — code present, not in merge path', NULL, 'pending'),
  ('tavily', 'Tavily', 'TAVILY_API_KEY', 'tavily', 0.001, 'Optional campaign analyst search', NULL, 'pending'),
  ('google_translate', 'Google Translate', 'GOOGLE_TRANSLATE_API_KEY', 'google_translate', 0.00002, 'POST /api/translate', NULL, 'pending')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  env_var = EXCLUDED.env_var,
  provider = EXCLUDED.provider,
  notes = EXCLUDED.notes,
  daily_free_limit = EXCLUDED.daily_free_limit,
  lifecycle_status = EXCLUDED.lifecycle_status,
  updated_at = timezone('utc'::text, now());

NOTIFY pgrst, 'reload schema';
