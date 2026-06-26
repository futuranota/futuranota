-- Listar todas las tablas en public (para detectar mezcla de proyectos)
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Tablas definidas en este repo (Futura Nota) — compará con el resultado arriba:
-- profiles
-- hero_signals
-- signal_campaigns
-- intel_scan_sources
-- campaign_studies
-- weather_cache
-- companies
-- campaigns
-- nodes
-- canvas_nodes
-- canvas_connections
-- groupings
-- timelines
-- intel_signals
