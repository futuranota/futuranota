-- Admin: real product-content + doc-images bytes per user_id
-- Run in Supabase SQL Editor. Idempotent. Service role only.
-- v2: also counts departments, to-dos, URL/password tables, timeline UI,
-- campaign studies, intel signals. Step-by-step lives inside nodes (already counted).
-- Re-run even if you already applied v1.

CREATE OR REPLACE FUNCTION public._sum_user_table_bytes(p_rel text)
RETURNS TABLE(user_id uuid, bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rel IS NULL OR p_rel !~ '^[a-z_][a-z0-9_]*$' THEN
    RETURN;
  END IF;
  IF to_regclass('public.' || p_rel) IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY EXECUTE format(
    $q$
      SELECT t.user_id, COALESCE(SUM(pg_column_size(t.*)), 0)::bigint
      FROM public.%I t
      WHERE t.user_id IS NOT NULL
      GROUP BY t.user_id
    $q$,
    p_rel
  );
END;
$$;

REVOKE ALL ON FUNCTION public._sum_user_table_bytes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._sum_user_table_bytes(text) TO service_role;

CREATE OR REPLACE FUNCTION public._sum_intel_signals_bytes()
RETURNS TABLE(user_id uuid, bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.intel_signals') IS NULL
     OR to_regclass('public.campaigns') IS NULL THEN
    RETURN;
  END IF;
  -- Live schema may not have campaign_id (CREATE TABLE IF NOT EXISTS never added it).
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'intel_signals'
      AND column_name = 'campaign_id'
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.user_id, COALESCE(SUM(pg_column_size(s.*)), 0)::bigint
  FROM public.intel_signals s
  INNER JOIN public.campaigns c ON c.id = s.campaign_id
  WHERE c.user_id IS NOT NULL
  GROUP BY c.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public._sum_intel_signals_bytes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._sum_intel_signals_bytes() TO service_role;

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
    SELECT * FROM public._sum_user_table_bytes('companies')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('campaigns')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('nodes')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('canvas_nodes')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('canvas_connections')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('groupings')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('timelines')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('departments')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('lazy_todos')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('url_tables')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('url_table_entries')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('password_table_entries')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('user_timeline_ui')
    UNION ALL SELECT * FROM public._sum_user_table_bytes('campaign_studies')
    UNION ALL SELECT * FROM public._sum_intel_signals_bytes()
  )
  SELECT parts.user_id, SUM(parts.bytes)::bigint
  FROM parts
  GROUP BY parts.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_db_bytes_by_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_db_bytes_by_user() TO service_role;

COMMENT ON FUNCTION public.get_workspace_db_bytes_by_user() IS
  'Admin: sum pg_column_size of plan-fill content per user (docs/meta/steps, folders, canvas, depts, todos, URLs, passwords, timeline UI, studies). Not WAL/indexes/admin logs.';

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

NOTIFY pgrst, 'reload schema';
