-- Reparación rápida: columnas faltantes en signal_campaigns / hero_signals
-- Ejecutar TODO de una vez si ves PGRST204 (announcement_date, detection_mode, etc.)

ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS announcement_date DATE;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS detection_mode TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS confidence INT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS ticket_tier TEXT;

ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS last_launch_date DATE;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS average_interval_months NUMERIC;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS overview TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS announcement_date DATE;

ALTER TABLE public.signal_campaigns
  DROP CONSTRAINT IF EXISTS signal_campaigns_status_check;

ALTER TABLE public.signal_campaigns
  ADD CONSTRAINT signal_campaigns_status_check
  CHECK (status IN ('pending', 'published'));

UPDATE public.signal_campaigns
SET status = 'pending'
WHERE status IS NULL OR status = '';

NOTIFY pgrst, 'reload schema';
