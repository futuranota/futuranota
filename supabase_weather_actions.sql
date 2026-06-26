-- Weather forecast actions counter (node inserts + city changes after first city).
-- Run in Supabase SQL editor after supabase_plans.sql.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weather_actions_count INTEGER NOT NULL DEFAULT 0;

-- Backfill from legacy boolean when present.
UPDATE public.profiles
SET weather_actions_count = 1
WHERE weather_used = TRUE
  AND weather_actions_count = 0;
