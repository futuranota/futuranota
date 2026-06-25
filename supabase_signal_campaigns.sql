-- Tabla para las señales de campaña detectadas por Groq desde /panel (Campaign Detector).
-- Fuente de datos futura para las cards de Signal en la app. Ejecutar una sola vez en el SQL editor de Supabase.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Columna añadida después de la creación inicial; idempotente para tablas ya existentes.
ALTER TABLE public.signal_campaigns ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.signal_campaigns ENABLE ROW LEVEL SECURITY;

-- Lectura pública solo e las señales activas (lo que eventualmente alimenta Signal).
DROP POLICY IF EXISTS "Lectura publica de campanas activas" ON public.signal_campaigns;
CREATE POLICY "Lectura publica de campanas activas" ON public.signal_campaigns
    FOR SELECT USING (active = true);

-- Cualquier usuario autenticado puede leer todo (lo necesita el panel /panel;
-- la restricción a un email concreto se hace en la app, vía VITE_ADMIN_EMAIL).
DROP POLICY IF EXISTS "Lectura autenticada de todo" ON public.signal_campaigns;
CREATE POLICY "Lectura autenticada de todo" ON public.signal_campaigns
    FOR SELECT TO authenticated USING (true);

-- Escritura (insert/update/delete) solo para usuarios autenticados.
DROP POLICY IF EXISTS "Escritura autenticada" ON public.signal_campaigns;
CREATE POLICY "Escritura autenticada" ON public.signal_campaigns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
