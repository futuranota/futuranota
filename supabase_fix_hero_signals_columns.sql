-- Fix: columnas faltantes en hero_signals + recarga schema cache de PostgREST
-- Ejecutar en Supabase → SQL Editor si ves errores como:
--   "Could not find the 'category' column of 'hero_signals' in the schema cache"

ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS last_launch_date DATE;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS average_interval_months NUMERIC;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS overview TEXT;
ALTER TABLE public.hero_signals ADD COLUMN IF NOT EXISTS category TEXT;

-- Fuerza a PostgREST (API de Supabase) a releer el esquema
NOTIFY pgrst, 'reload schema';
