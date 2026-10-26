alter table public.prompt_steps
  add column if not exists recommended_model text default '';
