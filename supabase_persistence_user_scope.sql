-- Futura Nota — user-scoped canvas persistence (companies, campaigns, nodes, …)
-- Run once in Supabase → SQL Editor.
-- Fixes: missing user_id columns, RLS blocking upsert (42501), multi-tenant isolation.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── user_id on all persisted tables ─────────────────────────────────────────

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.canvas_nodes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.canvas_connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.groupings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.timelines ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS companies_user_id_idx ON public.companies (user_id);
CREATE INDEX IF NOT EXISTS campaigns_user_id_idx ON public.campaigns (user_id);
CREATE INDEX IF NOT EXISTS nodes_user_id_idx ON public.nodes (user_id);
CREATE INDEX IF NOT EXISTS canvas_nodes_user_id_idx ON public.canvas_nodes (user_id);
CREATE INDEX IF NOT EXISTS canvas_connections_user_id_idx ON public.canvas_connections (user_id);
CREATE INDEX IF NOT EXISTS groupings_user_id_idx ON public.groupings (user_id);
CREATE INDEX IF NOT EXISTS timelines_user_id_idx ON public.timelines (user_id);

-- ── RLS: authenticated users own their rows ─────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groupings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;

-- Drop legacy permissive / conflicting policies
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.companies;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.campaigns;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.nodes;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.canvas_nodes;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.canvas_connections;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.groupings;
DROP POLICY IF EXISTS "Permitir todo a todos" ON public.timelines;

DROP POLICY IF EXISTS "companies_owner_all" ON public.companies;
DROP POLICY IF EXISTS "campaigns_owner_all" ON public.campaigns;
DROP POLICY IF EXISTS "nodes_owner_all" ON public.nodes;
DROP POLICY IF EXISTS "canvas_nodes_owner_all" ON public.canvas_nodes;
DROP POLICY IF EXISTS "canvas_connections_owner_all" ON public.canvas_connections;
DROP POLICY IF EXISTS "groupings_owner_all" ON public.groupings;
DROP POLICY IF EXISTS "timelines_owner_all" ON public.timelines;

CREATE POLICY "companies_owner_all" ON public.companies
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "campaigns_owner_all" ON public.campaigns
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nodes_owner_all" ON public.nodes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "canvas_nodes_owner_all" ON public.canvas_nodes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "canvas_connections_owner_all" ON public.canvas_connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "groupings_owner_all" ON public.groupings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timelines_owner_all" ON public.timelines
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
