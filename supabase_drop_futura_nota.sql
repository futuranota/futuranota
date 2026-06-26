-- ═══════════════════════════════════════════════════════════════════════════
-- FUTURA NOTA — ELIMINAR TODAS LAS TABLAS public.* DEL PROYECTO
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️  DESTRUCTIVO: borra datos. No toca auth.users ni otras tablas ajenas.
-- Ejecutar en Supabase SQL Editor del proyecto que quieras LIMPIAR.
--
-- Antes de borrar, listá qué hay:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--
-- Tablas Futura Nota (14):
--   profiles, hero_signals, signal_campaigns, intel_scan_sources,
--   campaign_studies, weather_cache,
--   companies, campaigns, nodes, canvas_nodes, canvas_connections,
--   groupings, timelines, intel_signals
--
-- Re-aplicar en proyecto correcto (orden):
--   1. supabase_schema_upgrade.sql     (canvas sync — si usás persistencia cloud)
--   2. supabase_plans.sql
--   3. supabase_dashboard_apis.sql     (o plans_tokens + campaign_studies + weather_cache)
--   4. supabase_campaign_pipeline.sql  (hero_signals + signal_campaigns)
--   5. supabase_intel_scan_sources.sql
--   6. supabase_signal_campaigns_repair.sql  (solo si save en /panel falla)
-- ═══════════════════════════════════════════════════════════════════════════

-- Trigger / función de registro
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Dashboard APIs (dependen de auth.users)
DROP TABLE IF EXISTS public.campaign_studies CASCADE;
DROP TABLE IF EXISTS public.weather_cache CASCADE;

-- Canvas / sync cloud (orden: hijos → padres)
DROP TABLE IF EXISTS public.canvas_connections CASCADE;
DROP TABLE IF EXISTS public.canvas_nodes CASCADE;
DROP TABLE IF EXISTS public.nodes CASCADE;
DROP TABLE IF EXISTS public.groupings CASCADE;
DROP TABLE IF EXISTS public.timelines CASCADE;
DROP TABLE IF EXISTS public.intel_signals CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;

-- Admin / panel / librería
DROP TABLE IF EXISTS public.signal_campaigns CASCADE;
DROP TABLE IF EXISTS public.hero_signals CASCADE;
DROP TABLE IF EXISTS public.intel_scan_sources CASCADE;

-- Planes / usuarios
DROP TABLE IF EXISTS public.profiles CASCADE;

NOTIFY pgrst, 'reload schema';
