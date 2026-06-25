-- Curated scan sources for Horizon Scan (Phase B)
-- Ejecutar en Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.intel_scan_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL,
    domain TEXT NOT NULL,
    path_prefix TEXT DEFAULT '',
    tier TEXT NOT NULL DEFAULT 'primary' CHECK (tier IN ('primary', 'secondary')),
    categories TEXT[] NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.intel_scan_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura autenticada scan sources" ON public.intel_scan_sources;
CREATE POLICY "Lectura autenticada scan sources" ON public.intel_scan_sources
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Escritura autenticada scan sources" ON public.intel_scan_sources;
CREATE POLICY "Escritura autenticada scan sources" ON public.intel_scan_sources
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.intel_scan_sources (label, domain, path_prefix, tier, categories, enabled)
SELECT v.label, v.domain, v.path_prefix, v.tier, v.categories, true
FROM (VALUES
    ('The Verge', 'theverge.com', '', 'primary', ARRAY['physical_tech', 'innovation']::TEXT[]),
    ('Engadget', 'engadget.com', '', 'primary', ARRAY['physical_tech']::TEXT[]),
    ('Hypebeast', 'hypebeast.com', '', 'primary', ARRAY['physical', 'innovation']::TEXT[]),
    ('Apple Newsroom', 'apple.com', '/newsroom', 'primary', ARRAY['physical_tech', 'innovation']::TEXT[]),
    ('Nike News', 'news.nike.com', '', 'primary', ARRAY['sports', 'physical']::TEXT[]),
    ('GearJunkie', 'gearjunkie.com', '', 'primary', ARRAY['sports', 'physical']::TEXT[])
) AS v(label, domain, path_prefix, tier, categories)
WHERE NOT EXISTS (SELECT 1 FROM public.intel_scan_sources LIMIT 1);

NOTIFY pgrst, 'reload schema';
