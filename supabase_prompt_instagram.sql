-- Allow Instagram on prompt pages. Run once in the Supabase SQL Editor.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'prompt_steps'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%video_provider%'
  loop
    execute format('alter table public.prompt_steps drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.prompt_steps
  add constraint prompt_steps_video_provider_check
  check (
    video_provider is null
    or video_provider in ('youtube', 'vimeo', 'instagram')
  );
