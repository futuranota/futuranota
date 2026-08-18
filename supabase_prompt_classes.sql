-- Prompt classifications (characters, element, …) on folder + document libraries.
-- Run in Supabase SQL Editor. Empty classes persist even before fichas use them.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS prompt_classes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.nodes
  ADD COLUMN IF NOT EXISTS prompt_classes JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
