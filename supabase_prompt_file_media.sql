alter table public.prompt_files
  add column if not exists pdf_name text,
  add column if not exists pdf_path text,
  add column if not exists video_provider text,
  add column if not exists video_id text,
  add column if not exists video_raw_input text,
  add column if not exists video_embed_src text;
