-- Link lazy to-dos to a document (node) for in-doc create + Gina.
-- Run in Supabase SQL Editor after supabase_lazy_todos.sql

ALTER TABLE public.lazy_todos
  ADD COLUMN IF NOT EXISTS document_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS lazy_todos_document_id_idx
  ON public.lazy_todos (document_id);

NOTIFY pgrst, 'reload schema';
