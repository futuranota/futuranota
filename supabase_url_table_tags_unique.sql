-- DEPRECATED: uniqueness for URL-table tags was removed.
-- Run instead: supabase_url_table_allow_duplicate_tags.sql
--
-- This file only drops the old unique indexes so accidental re-runs of this
-- filename cannot re-introduce the constraint.

DROP INDEX IF EXISTS public.url_table_entries_user_object_table_tag_uidx;
DROP INDEX IF EXISTS public.url_table_entries_user_object_tag_uidx;
