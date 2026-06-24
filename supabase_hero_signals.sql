-- Tabla para los "signal cards" del Hero (CAMPAIGN DETECTED) gestionados desde /admin.
-- Ejecutar una sola vez en el SQL editor de Supabase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.hero_signals ENABLE ROW LEVEL SECURITY;

-- Lectura pública solo de la señal activa (la que se muestra en el landing).
DROP POLICY IF EXISTS "Lectura publica de senal activa" ON public.hero_signals;
CREATE POLICY "Lectura publica de senal activa" ON public.hero_signals
    FOR SELECT USING (active = true);

-- Cualquier usuario autenticado puede leer todo (lo necesita el panel /admin;
-- la restricción a un email concreto se hace en la app, vía VITE_ADMIN_EMAIL).
DROP POLICY IF EXISTS "Lectura autenticada de todo" ON public.hero_signals;
CREATE POLICY "Lectura autenticada de todo" ON public.hero_signals
    FOR SELECT TO authenticated USING (true);

-- Escritura (insert/update/delete) solo para usuarios autenticados.
DROP POLICY IF EXISTS "Escritura autenticada" ON public.hero_signals;
CREATE POLICY "Escritura autenticada" ON public.hero_signals
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Semilla opcional con la señal de ejemplo que hoy vive en content/marketing/home.json
INSERT INTO public.hero_signals (campaign_name, window_progress, opens_label, closes_label, nodes, active)
VALUES (
    'NovaBrew · single-origin launch',
    62,
    'opens now',
    'closes in 9d',
    '[
        {"hash": "problem", "text": "mugs ship cold, look generic"},
        {"hash": "make", "text": "hand-thrown stoneware, matte glaze"},
        {"hash": "window", "text": "drop day 0 → day 9"}
    ]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;
