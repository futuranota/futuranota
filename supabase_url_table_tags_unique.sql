-- Unique URL-table tags per table (case-insensitive).
-- Same tag text MAY exist in different tables of the same company.
-- Run in Supabase SQL Editor after reviewing / resolving within-table duplicates.

-- 0) Drop the previous company-wide unique index if it exists.
DROP INDEX IF EXISTS public.url_table_entries_user_object_tag_uidx;

-- 1) Inspect existing duplicates INSIDE the same table (do not skip this step).
-- SELECT user_id, object_id, table_id, lower(trim(tag)) AS tag_key, count(*) AS n, array_agg(id) AS entry_ids
-- FROM public.url_table_entries
-- WHERE coalesce(trim(tag), '') <> ''
--   AND coalesce(trim(table_id), '') <> ''
-- GROUP BY user_id, object_id, table_id, lower(trim(tag))
-- HAVING count(*) > 1;

-- 2) Create a partial unique index once within-table duplicates are resolved.
CREATE UNIQUE INDEX IF NOT EXISTS url_table_entries_user_object_table_tag_uidx
  ON public.url_table_entries (user_id, object_id, table_id, lower(trim(tag)))
  WHERE coalesce(trim(tag), '') <> ''
    AND coalesce(trim(table_id), '') <> '';
