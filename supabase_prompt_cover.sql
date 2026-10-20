alter table public.prompt_files
  add column if not exists cover_path text;
