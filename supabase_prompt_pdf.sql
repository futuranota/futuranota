alter table public.prompt_steps
  add column if not exists pdf_name text,
  add column if not exists pdf_path text;
