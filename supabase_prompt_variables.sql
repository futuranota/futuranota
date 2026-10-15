alter table public.prompt_files
  add column if not exists variables jsonb not null default '[]'::jsonb;
