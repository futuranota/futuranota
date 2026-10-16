alter table public.prompt_steps
  add column if not exists pdf_page integer;
