-- URL table: affiliate tracking fields (Pro per-row).
-- Run in Supabase SQL Editor after supabase_url_table_entries.sql

ALTER TABLE public.url_table_entries
  ADD COLUMN IF NOT EXISTS commission_rate DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS product_price DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cookie_days INTEGER,
  ADD COLUMN IF NOT EXISTS affiliate_status TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clients_won INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'url_table_entries_affiliate_status_check'
  ) THEN
    ALTER TABLE public.url_table_entries
      ADD CONSTRAINT url_table_entries_affiliate_status_check
      CHECK (affiliate_status IN ('', 'pending', 'active', 'expired'));
  END IF;
END $$;
