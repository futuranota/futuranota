-- Multi-URL list on prompt files (Home URL panel + teleprompter).
-- Keeps reference_url / reference_name as mirrors of the first entry.

alter table public.prompt_files
  add column if not exists url_references jsonb default '[]'::jsonb;
