-- URL tables: kind = links (default) | affiliates (Pro tracker tables).
-- Run in Supabase SQL Editor after supabase_url_tables.sql

ALTER TABLE public.url_tables
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'links';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'url_tables_kind_check'
  ) THEN
    ALTER TABLE public.url_tables
      ADD CONSTRAINT url_tables_kind_check
      CHECK (kind IN ('links', 'affiliates'));
  END IF;
END $$;
