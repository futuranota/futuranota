-- Allow duplicate URL-table tags (within and across tables) + cap description at 500 chars.
-- Run in Supabase SQL Editor. Safe to re-run (idempotent).
-- Replaces the previous unique-tag index from supabase_url_table_tags_unique.sql.

-- 1) Drop uniqueness indexes (current within-table + legacy company-wide).
DROP INDEX IF EXISTS public.url_table_entries_user_object_table_tag_uidx;
DROP INDEX IF EXISTS public.url_table_entries_user_object_tag_uidx;

-- 2) Optional non-unique lookup index (same keys, no uniqueness).
CREATE INDEX IF NOT EXISTS url_table_entries_user_object_table_tag_idx
  ON public.url_table_entries (user_id, object_id, table_id, lower(trim(tag)))
  WHERE coalesce(trim(tag), '') <> ''
    AND coalesce(trim(table_id), '') <> '';

-- 3) Truncate existing descriptions longer than 500 characters.
UPDATE public.url_table_entries
SET description = left(description, 500)
WHERE char_length(description) > 500;

-- 4) Enforce 500-char max on description going forward.
ALTER TABLE public.url_table_entries
  DROP CONSTRAINT IF EXISTS url_table_entries_description_len_chk;

ALTER TABLE public.url_table_entries
  ADD CONSTRAINT url_table_entries_description_len_chk
  CHECK (char_length(description) <= 500);
