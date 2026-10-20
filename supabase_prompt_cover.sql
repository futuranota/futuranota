alter table public.prompt_files
  add column if not exists cover_path text;

alter table public.prompt_files
  add column if not exists cover_skipped boolean not null default false;
