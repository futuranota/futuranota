alter table public.prompt_files
  add column if not exists reference_url text;

alter table public.prompt_files
  add column if not exists reference_name text;
