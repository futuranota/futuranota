alter table public.prompt_steps
  add column if not exists sheet_face smallint;

alter table public.prompt_steps
  drop constraint if exists prompt_steps_sheet_face_check;

alter table public.prompt_steps
  add constraint prompt_steps_sheet_face_check
  check (sheet_face is null or sheet_face in (0, 1));
