-- URL table: add tag + category columns (existing DBs).
-- Run in Supabase SQL Editor after supabase_url_table_entries.sql

ALTER TABLE public.url_table_entries
  ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
