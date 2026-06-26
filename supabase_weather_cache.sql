-- Cache OpenWeather por ciudad (TTL ~45 min en app)
CREATE TABLE IF NOT EXISTS public.weather_cache (
    cache_key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read weather cache" ON public.weather_cache;
DROP POLICY IF EXISTS "write weather cache service" ON public.weather_cache;

CREATE POLICY "read weather cache" ON public.weather_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "write weather cache service" ON public.weather_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
