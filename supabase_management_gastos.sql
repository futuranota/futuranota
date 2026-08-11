-- Admin Gastos: product subscriptions for margin (MRR − API$ − gastos/mes)
-- Run in Supabase SQL Editor. Idempotent.
-- Annual plans count as amount_usd / 12 toward monthly margin.

CREATE TABLE IF NOT EXISTS public.admin_gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  billing TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing IN ('monthly', 'annual')),
  amount_usd NUMERIC(12, 4) NOT NULL DEFAULT 0,
  started_at DATE NOT NULL DEFAULT (timezone('utc'::text, now())::date),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS admin_gastos_started_at_idx
  ON public.admin_gastos (started_at DESC);

ALTER TABLE public.admin_gastos ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (admin panel) reads/writes.

COMMENT ON TABLE public.admin_gastos IS
  'Admin product costs (Cursor, storage, …). Margin uses monthly burn (annual ÷ 12).';

-- Optional: drop legacy category opex table if you already ran supabase_management_opex.sql
-- DROP TABLE IF EXISTS public.admin_opex_entries;
