alter table public.prompt_steps
  add column if not exists description text;
