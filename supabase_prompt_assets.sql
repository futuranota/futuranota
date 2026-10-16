alter table public.prompt_files
  add column if not exists assets jsonb not null default '[]'::jsonb;
