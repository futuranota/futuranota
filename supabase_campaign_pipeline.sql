-- Futura Nota — Admin signals bootstrap (cola + hero + pipeline Launch Radar)
-- Ejecutar UNA vez en Supabase → SQL Editor.
-- Idempotente: seguro si las tablas ya existen o si es un proyecto nuevo.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. hero_signals (Signals tab + Librería + Launch Radar) ─────────────────

CREATE TABLE IF NOT EXISTS public.hero_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detected_label TEXT NOT NULL DEFAULT 'CAMPAIGN DETECTED',
    campaign_name TEXT NOT NULL,
    window_label TEXT NOT NULL DEFAULT 'SHIP WINDOW',
    window_progress INT NOT NULL DEFAULT 50 CHECK (window_progress BETWEEN 0 AND 100),
    opens_label TEXT NOT NULL DEFAULT 'opens now',
    closes_label TEXT NOT NULL DEFAULT 'closes in 9d',
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    brand_name TEXT,
    launch_date DATE,
    last_launch_date DATE,
    average_interval_months NUMERIC,
    overview TEXT,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS last_launch_date DATE;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS average_interval_months NUMERIC;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS overview TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.hero_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de senal activa" ON public.hero_signals;
CREATE POLICY "Lectura publica de senal activa" ON public.hero_signals
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Lectura autenticada de todo" ON public.hero_signals;
CREATE POLICY "Lectura autenticada de todo" ON public.hero_signals
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escritura autenticada" ON public.hero_signals;
CREATE POLICY "Escritura autenticada" ON public.hero_signals
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. signal_campaigns (cola Horizon Scan / Campaign Detector) ─────────────

CREATE TABLE IF NOT EXISTS public.signal_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name TEXT NOT NULL,
    category TEXT,
    campaign_active BOOLEAN NOT NULL DEFAULT FALSE,
    launch_date DATE,
    overview TEXT,
    average_interval_months NUMERIC,
    last_launch_date DATE,
    source TEXT,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS announcement_date DATE;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS detection_mode TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS confidence INT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS evidence_url TEXT;
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS ticket_tier TEXT;

ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS announcement_date DATE;

ALTER TABLE public.signal_campaigns
  DROP CONSTRAINT IF EXISTS signal_campaigns_status_check;

ALTER TABLE public.signal_campaigns
  ADD CONSTRAINT signal_campaigns_status_check
  CHECK (status IN ('pending', 'published'));

UPDATE public.signal_campaigns
SET status = 'pending'
WHERE status IS NULL OR status = '';

ALTER TABLE public.signal_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica de campanas activas" ON public.signal_campaigns;
CREATE POLICY "Lectura publica de campanas activas" ON public.signal_campaigns
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Lectura autenticada de todo" ON public.signal_campaigns;
CREATE POLICY "Lectura autenticada de todo" ON public.signal_campaigns
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escritura autenticada" ON public.signal_campaigns;
CREATE POLICY "Escritura autenticada" ON public.signal_campaigns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Semilla opcional (solo si hero_signals está vacío) ───────────────────

INSERT INTO public.hero_signals (
    campaign_name, window_progress, opens_label, closes_label, nodes, active, brand_name
)
SELECT
    'NovaBrew · single-origin launch',
    62,
    'opens now',
    'closes in 9d',
    '[
        {"hash": "problem", "text": "mugs ship cold, look generic"},
        {"hash": "make", "text": "hand-thrown stoneware, matte glaze"},
        {"hash": "window", "text": "drop day 0 → day 9"}
    ]'::jsonb,
    true,
    'NovaBrew'
WHERE NOT EXISTS (SELECT 1 FROM public.hero_signals LIMIT 1);

NOTIFY pgrst, 'reload schema';
