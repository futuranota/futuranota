-- URL table: per-row affiliate currency (Pro).
-- Run in Supabase SQL Editor after supabase_url_table_entries_affiliate.sql

ALTER TABLE public.url_table_entries
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
