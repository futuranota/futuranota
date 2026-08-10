-- Phase A: real provider usage columns on api_usage_events
-- Run after supabase_management.sql
-- Idempotent — safe to re-run.

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS input_tokens INT NOT NULL DEFAULT 0;

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS output_tokens INT NOT NULL DEFAULT 0;

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS compute_units NUMERIC(12, 6);

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS usage_total_usd NUMERIC(12, 6);

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS item_count INT;

ALTER TABLE public.api_usage_events
  ADD COLUMN IF NOT EXISTS billed BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.api_usage_events.input_tokens IS 'Provider LLM prompt tokens (not plan tokens_debited)';
COMMENT ON COLUMN public.api_usage_events.output_tokens IS 'Provider LLM completion tokens (not plan tokens_debited)';
COMMENT ON COLUMN public.api_usage_events.tokens_debited IS 'Product plan tokens charged to the user';
COMMENT ON COLUMN public.api_usage_events.billed IS 'False for mock / free-tier / non-provider paths';

NOTIFY pgrst, 'reload schema';
