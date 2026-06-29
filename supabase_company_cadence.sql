-- Futura Nota — persist Launch Radar / Market Hype panel state on companies
-- Run once in Supabase → SQL Editor.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cadence JSONB NOT NULL DEFAULT '{}'::jsonb;
