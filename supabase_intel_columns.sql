-- Intel columns for verified Horizon Scan (Phase 2)
-- Run after supabase_campaign_pipeline.sql

ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS announcement_date DATE;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS detection_mode TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS confidence INT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS ticket_tier TEXT;

ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS announcement_date DATE;

NOTIFY pgrst, 'reload schema';
