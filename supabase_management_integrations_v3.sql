-- Management integrations v3: meta description + dashboard quick link
-- Run after supabase_management_integrations_v2.sql
-- Idempotent — safe to re-run.

ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';

ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS dashboard_url TEXT NOT NULL DEFAULT '';

UPDATE public.api_integrations AS t SET
  meta_description = v.meta_description,
  dashboard_url = v.dashboard_url,
  updated_at = timezone('utc'::text, now())
FROM (VALUES
  (
    'groq',
    'LLM principal de Futura Nota: Intel Search, Gina, Launch Radar, Campaign Study y agents. Inferencia rápida vía Groq Cloud.',
    'https://console.groq.com'
  ),
  (
    'gemini',
    'Fallback LLM opcional (Google AI). Pendiente — no es el path diario; se usa si Groq falla y hay key.',
    'https://aistudio.google.com/apikey'
  ),
  (
    'serper',
    'Búsqueda web en vivo (Google vía Serper): Intel overview, Horizon Scan y señales de Market/Social Hype.',
    'https://serper.dev/dashboard'
  ),
  (
    'dataforseo',
    'SEO / SERP enrichment: People Also Ask e intent en Campaign Study; señales extra en social hype.',
    'https://app.dataforseo.com'
  ),
  (
    'apify',
    'Monitoreo de tendencias en redes sociales: actores/scrapers listos para Twitter, TikTok y Reddit vía API (Market Hype / Campaign Study).',
    'https://console.apify.com'
  ),
  (
    'openweather',
    'Forecast del clima para nodos y widgets de predicción (ventana de días desde OpenWeather).',
    'https://home.openweathermap.org/api_keys'
  ),
  (
    'supabase',
    'Base de datos, auth y sync del workspace. Gasto fijo de plan (egress) — no se cobra por call en esta tabla.',
    'https://supabase.com/dashboard'
  ),
  (
    'calendarific',
    'Feriados y observances por país en el calendario de eventos de marketing (/api/events).',
    'https://calendarific.com/account'
  ),
  (
    'resend',
    'Email transaccional: invitaciones de referral. Plan free — llevar conteo de envíos.',
    'https://resend.com/emails'
  ),
  (
    'predicthq',
    'Eventos públicos (conciertos, deportes, etc.). Código presente; hoy no está en el merge del calendario.',
    'https://control.predicthq.com'
  ),
  (
    'tavily',
    'Búsqueda web opcional para Campaign Analyst (Pass 1). Solo si TAVILY_API_KEY está configurada.',
    'https://app.tavily.com'
  ),
  (
    'google_translate',
    'Traducción de textos vía Cloud Translation API (POST /api/translate).',
    'https://console.cloud.google.com/apis/library/translate.googleapis.com'
  )
) AS v(id, meta_description, dashboard_url)
WHERE t.id = v.id;

NOTIFY pgrst, 'reload schema';
