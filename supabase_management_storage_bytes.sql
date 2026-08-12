-- Admin: real workspace + doc-images bytes per user_id
-- Run in Supabase SQL Editor. Idempotent. Service role only.

CREATE OR REPLACE FUNCTION public.get_workspace_db_bytes_by_user()
RETURNS TABLE(user_id uuid, bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH parts AS (
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes
    FROM public.companies t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
    UNION ALL
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
    FROM public.campaigns t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
    UNION ALL
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
    FROM public.nodes t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
    UNION ALL
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
    FROM public.canvas_nodes t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
    UNION ALL
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
    FROM public.canvas_connections t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
    UNION ALL
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
    FROM public.groupings t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
    UNION ALL
    SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
    FROM public.timelines t
    WHERE t.user_id IS NOT NULL
    GROUP BY t.user_id
  )
  SELECT parts.user_id, SUM(parts.bytes)::bigint
  FROM parts
  GROUP BY parts.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_db_bytes_by_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_db_bytes_by_user() TO service_role;

COMMENT ON FUNCTION public.get_workspace_db_bytes_by_user() IS
  'Admin: sum pg_column_size of workspace rows per user_id (Postgres disk, not Storage).';

CREATE OR REPLACE FUNCTION public.get_doc_images_bytes_by_user()
RETURNS TABLE(user_id text, bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT
    (storage.foldername(o.name))[1] AS user_id,
    COALESCE(SUM((o.metadata->>'size')::bigint), 0)::bigint AS bytes
  FROM storage.objects o
  WHERE o.bucket_id = 'doc-images'
    AND (storage.foldername(o.name))[1] IS NOT NULL
    AND COALESCE(o.metadata->>'size', '') ~ '^[0-9]+$'
  GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION public.get_doc_images_bytes_by_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_doc_images_bytes_by_user() TO service_role;

COMMENT ON FUNCTION public.get_doc_images_bytes_by_user() IS
  'Admin: sum doc-images object metadata.size grouped by first path segment (auth uid).';
