alter table public.prompt_steps
  add column if not exists model_ids jsonb default '[]'::jsonb;
