-- Futura Nota — eliminar UNA tabla (copiá solo el bloque que necesites)
-- Ejecutar en Supabase SQL Editor. CASCADE quita FKs hijas de esa tabla.
-- No toca auth.users.

-- ── Dashboard / planes ───────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.campaign_studies CASCADE;
-- DROP TABLE IF EXISTS public.weather_cache CASCADE;

-- ── Admin / panel / librería ─────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.signal_campaigns CASCADE;
-- DROP TABLE IF EXISTS public.hero_signals CASCADE;
-- DROP TABLE IF EXISTS public.intel_scan_sources CASCADE;

-- ── Canvas sync cloud (borrar hijos antes que padres si CASCADE falla) ───────
-- DROP TABLE IF EXISTS public.canvas_connections CASCADE;
-- DROP TABLE IF EXISTS public.canvas_nodes CASCADE;
-- DROP TABLE IF EXISTS public.nodes CASCADE;
-- DROP TABLE IF EXISTS public.groupings CASCADE;
-- DROP TABLE IF EXISTS public.timelines CASCADE;
-- DROP TABLE IF EXISTS public.intel_signals CASCADE;
-- DROP TABLE IF EXISTS public.campaigns CASCADE;
-- DROP TABLE IF EXISTS public.companies CASCADE;

-- ── Solo trigger de profiles (sin borrar la tabla) ─────────────────────────
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();

NOTIFY pgrst, 'reload schema';
