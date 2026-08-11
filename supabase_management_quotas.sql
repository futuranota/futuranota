-- Admin Quota meters (Storage & Quotas — Tabla A: API free / calls)
-- Run in Supabase SQL Editor. Idempotent.
-- Reset? false = one-shot welcome pack. Reset? true = every N day|month window.

CREATE TABLE IF NOT EXISTS public.admin_quota_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  provider TEXT,
  meter_kind TEXT NOT NULL DEFAULT 'calls'
    CHECK (meter_kind IN ('calls', 'tokens')),
  included NUMERIC(18, 4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'calls',
  type TEXT NOT NULL DEFAULT 'free'
    CHECK (type IN ('free', 'welcome', 'paid')),
  resets BOOLEAN NOT NULL DEFAULT true,
  every_n INT,
  every_unit TEXT
    CHECK (every_unit IS NULL OR every_unit IN ('day', 'month')),
  overage_usd NUMERIC(18, 8),
  anchor_at DATE,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT admin_quota_meters_reset_every_chk CHECK (
    (resets = false)
    OR (resets = true AND every_n IS NOT NULL AND every_n >= 1 AND every_unit IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS admin_quota_meters_sort_idx
  ON public.admin_quota_meters (sort_order ASC, product_name ASC);

ALTER TABLE public.admin_quota_meters ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (admin panel) reads/writes.

COMMENT ON TABLE public.admin_quota_meters IS
  'Tabla A — provider free/call meters. Usage from api_usage_events in current window.';

-- Seed defaults (skip if product+provider+meter already present)
INSERT INTO public.admin_quota_meters (
  product_name, provider, meter_kind, included, unit, type,
  resets, every_n, every_unit, overage_usd, anchor_at, sort_order, notes
)
SELECT * FROM (VALUES
  (
    'Groq (Gina) — requests', 'groq', 'calls', 5000::numeric, 'calls', 'free',
    true, 1, 'month', NULL::numeric, '2026-02-20'::date, 10,
    'Free 5000 requests / month. Resets on the 20th (account anniversary).'
  ),
  (
    'Groq (Gina) — tokens', 'groq', 'tokens', 250000::numeric, 'tokens', 'free',
    true, 1, 'month', 0.000001575::numeric, '2026-02-20'::date, 20,
    'Free 250000 tokens / month. Resets on the 20th (account anniversary).'
  ),
  (
    'OpenWeather', 'openweather', 'calls', 1000::numeric, 'calls', 'free',
    true, 1, 'day', NULL::numeric, NULL::date, 30,
    '1000 calls / day. Set overage $/call when known.'
  ),
  (
    'Calendarific', 'calendarific', 'calls', 100::numeric, 'calls', 'free',
    true, 1, 'day', NULL::numeric, NULL::date, 40,
    'Typical free daily allowance.'
  ),
  (
    'Resend', 'resend', 'calls', 100::numeric, 'calls', 'free',
    true, 1, 'day', NULL::numeric, NULL::date, 50,
    'Free-tier style daily cap.'
  )
) AS v(
  product_name, provider, meter_kind, included, unit, type,
  resets, every_n, every_unit, overage_usd, anchor_at, sort_order, notes
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_quota_meters m
  WHERE m.provider IS NOT DISTINCT FROM v.provider
    AND m.meter_kind = v.meter_kind
    AND m.product_name = v.product_name
);

-- If Groq rows already existed without anniversary anchor, set the 20th
UPDATE public.admin_quota_meters
SET
  anchor_at = COALESCE(anchor_at, '2026-02-20'::date),
  notes = CASE
    WHEN notes IS NULL OR notes = '' OR notes LIKE '%UTC%'
      THEN 'Free tier resets on the 20th each month (account anniversary).'
    ELSE notes
  END,
  updated_at = timezone('utc'::text, now())
WHERE provider = 'groq';
