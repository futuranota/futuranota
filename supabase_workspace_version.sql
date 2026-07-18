-- Lightweight workspace version for hydrate gate (egress).
-- Returns max(updated_at) across workspace tables for the authenticated user.
-- Run in Supabase SQL Editor after core persistence schema exists.

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
      SELECT max(updated_at) FROM public.campaigns WHERE user_id = p_user_id
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
