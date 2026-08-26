-- Affiliate / URL-table entry cover image (Storage public URL).
-- Run in Supabase SQL Editor after supabase_url_table_entries.sql

ALTER TABLE public.url_table_entries
  ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
