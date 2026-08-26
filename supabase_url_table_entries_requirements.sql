-- Affiliate / URL-table entry requirements text.
-- Run in Supabase SQL Editor after supabase_url_table_entries.sql

ALTER TABLE public.url_table_entries
  ADD COLUMN IF NOT EXISTS requirements TEXT NOT NULL DEFAULT '';
