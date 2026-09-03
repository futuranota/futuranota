-- Futura Nota — rename workspace table `campaigns` → `folders`
-- UI: Documents sidebar = folder boxes; this table is NOT signal_campaigns (Horizon).
--
-- PREREQUISITES
--   1. Backup / wipe test data if you want a clean slate (see section at bottom).
--   2. Deploy app code that reads/writes table name `folders` (not `campaigns`).
--   3. Run this entire file once in Supabase → SQL Editor.
--
-- FK columns (campaign_id, parent_doc_id) stay named as-is — they still point to folder ids.

BEGIN;

-- ── 1. Table rename ───────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.campaigns RENAME TO folders;

-- ── 2. Indexes (names only; optional but clearer in Dashboard) ──────────────
ALTER INDEX IF EXISTS campaigns_user_id_idx RENAME TO folders_user_id_idx;
ALTER INDEX IF EXISTS campaigns_department_id_idx RENAME TO folders_department_id_idx;

-- ── 3. Check constraint rename (if present from folder_view_mode migration) ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaigns_view_mode_check'
      AND conrelid = 'public.folders'::regclass
  ) THEN
    ALTER TABLE public.folders
      RENAME CONSTRAINT campaigns_view_mode_check TO folders_view_mode_check;
  END IF;
END $$;

-- ── 4. RLS policies on folders ──────────────────────────────────────────────
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo a todos" ON public.folders;
DROP POLICY IF EXISTS "campaigns_owner_all" ON public.folders;

CREATE POLICY "folders_owner_all" ON public.folders
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. Workspace version RPC (hydrate gate) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_workspace_version(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN (
    SELECT max(v)
    FROM (
      SELECT max(updated_at) AS v FROM public.companies WHERE user_id = p_user_id
      UNION ALL
      SELECT max(updated_at) FROM public.folders WHERE user_id = p_user_id
      UNION ALL
      SELECT max(updated_at) FROM public.nodes WHERE user_id = p_user_id
      UNION ALL
      SELECT max(updated_at) FROM public.canvas_nodes WHERE user_id = p_user_id
      UNION ALL
      SELECT max(updated_at) FROM public.canvas_connections WHERE user_id = p_user_id
      UNION ALL
      SELECT max(updated_at) FROM public.groupings WHERE user_id = p_user_id
      UNION ALL
      SELECT max(updated_at) FROM public.timelines WHERE user_id = p_user_id
    ) s
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_workspace_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_version(uuid) TO service_role;

-- ── 6. Admin storage bytes (if management migration was applied) ────────────
CREATE OR REPLACE FUNCTION public._sum_intel_signals_bytes()
RETURNS TABLE(user_id uuid, bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.intel_signals') IS NULL
     OR to_regclass('public.folders') IS NULL THEN
    RETURN;
  END IF;
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
  INNER JOIN public.folders c ON c.id = s.campaign_id
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
    UNION ALL SELECT * FROM public._sum_user_table_bytes('folders')
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

-- ── 7. Refresh PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'folders';
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns';
-- (second query should return 0 rows)

-- ═══════════════════════════════════════════════════════════════════════════
-- OPTIONAL: clean slate before rename (only if table is still named campaigns)
-- Uncomment and run SEPARATELY before this migration if you want empty workspace.
-- ═══════════════════════════════════════════════════════════════════════════
-- TRUNCATE public.nodes, public.canvas_nodes, public.canvas_connections,
--   public.groupings, public.timelines, public.campaigns, public.companies
--   CASCADE;
